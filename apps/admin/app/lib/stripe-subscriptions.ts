import type Stripe from 'stripe'
import { tryGrantReferralReward } from '@/app/lib/referrals'
import {
  getBillingPlan,
  getGiztokensMonthlyForPlan,
  normalizeBillingPlanId,
  resolveBillingPlanId,
  type BillingPlanId,
} from '@/app/lib/subscription-plans'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'
import { getStripeClient } from '@/app/lib/stripe'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

function appendNote(current: string | null | undefined, note: string) {
  return [current, note].filter(Boolean).join('\n').slice(0, 2000)
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'trialing') return 'trial'
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'overdue'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  if (status === 'paused') return 'blocked'
  return 'active'
}

function resolvePlanFromStripeSubscription(subscription: Stripe.Subscription): BillingPlanId {
  const metadataPlan = normalizeBillingPlanId(subscription.metadata?.planId)
  if (metadataPlan) return metadataPlan

  const priceId = subscription.items.data[0]?.price?.id
  if (priceId) {
    for (const planId of ['monthly', 'semiannual', 'annual'] as const) {
      const envKey = getBillingPlan(planId).stripePriceEnv
      if (process.env[envKey]?.trim() === priceId) return planId
    }
  }

  return resolveBillingPlanId(subscription.metadata?.selected_plan)
}

function resolvePeriodEnd(subscription: Stripe.Subscription) {
  const end = subscription.trial_end ?? subscription.current_period_end
  return end ? new Date(end * 1000).toISOString() : null
}

function resolveTrialEnd(subscription: Stripe.Subscription) {
  return subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
}

export async function createStripeCheckoutSession(input: {
  ownerId: string
  email: string
  planId: BillingPlanId
}) {
  const stripe = getStripeClient()
  const plan = getBillingPlan(input.planId)
  const priceId = process.env[plan.stripePriceEnv]?.trim()
  if (!priceId) {
    throw new Error(`Variável ${plan.stripePriceEnv} não configurada.`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'pt-BR',
    customer_email: input.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_PROFESSORA_APP_URL?.replace(/\/$/, '') || 'https://app.approf.com.br'}?checkout=success&plan=${input.planId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_PROFESSORA_APP_URL?.replace(/\/$/, '') || 'https://app.approf.com.br'}?checkout=canceled&plan=${input.planId}`,
    client_reference_id: input.ownerId,
    payment_method_collection: 'always',
    subscription_data: {
      trial_period_days: plan.trialDays,
      metadata: {
        userId: input.ownerId,
        planId: input.planId,
        giztokensMonthly: String(plan.giztokensMonthly),
      },
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
    },
    metadata: {
      userId: input.ownerId,
      planId: input.planId,
      giztokensMonthly: String(plan.giztokensMonthly),
    },
  })

  return session
}

export async function upsertSubscriptionFromStripe(input: {
  userId: string
  planId: BillingPlanId
  stripeSubscriptionId: string
  stripeCustomerId?: string | null
  status: SubscriptionStatus
  trialExpiresAt?: string | null
  currentPeriodEnd?: string | null
  checkoutSessionUrl?: string | null
  note?: string
}) {
  const supabase = createSupabaseServiceClient()
  const { data: current, error: selectError } = await supabase
    .from('subscriptions')
    .select('id,notes')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (selectError) throw selectError

  const payload = {
    user_id: input.userId,
    status: input.status,
    plan: input.planId,
    provider: 'stripe' as const,
    external_reference: input.checkoutSessionUrl || input.stripeSubscriptionId,
    trial_expires_at: input.trialExpiresAt,
    current_period_end: input.currentPeriodEnd,
    notes: appendNote(current?.notes, input.note ?? `[${new Date().toISOString()}] Stripe subscription ${input.stripeSubscriptionId}`),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('subscriptions').upsert(payload, { onConflict: 'user_id' })
  if (error) throw error

  await syncMonthlyGiztokensAllowance(input.userId, input.planId)

  if (input.status === 'active') {
    await tryGrantReferralReward(input.userId).catch(() => undefined)
  }
}

export async function syncMonthlyGiztokensAllowance(ownerId: string, plan: string | BillingPlanId) {
  const supabase = createSupabaseServiceClient()
  const giztokensIncluded = getGiztokensMonthlyForPlan(typeof plan === 'string' ? plan : plan)
  const includedCostLimitCents = Math.round(giztokensIncluded / 10)
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)

  const { data: existing, error: selectError } = await supabase
    .from('ai_usage_wallets')
    .select('id,giztokens_included,included_cost_limit_cents')
    .eq('owner_id', ownerId)
    .eq('period_type', 'monthly')
    .eq('period_start', monthStart)
    .eq('period_end', monthEnd)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing?.id) {
    const { error } = await supabase
      .from('ai_usage_wallets')
      .update({
        giztokens_included: Math.max(existing.giztokens_included ?? 0, giztokensIncluded),
        included_cost_limit_cents: Math.max(existing.included_cost_limit_cents ?? 0, includedCostLimitCents),
        notes: `[${new Date().toISOString()}] Allowance mensal sincronizada pelo plano (${plan}).`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('ai_usage_wallets').insert({
    owner_id: ownerId,
    period_type: 'monthly',
    period_start: monthStart,
    period_end: monthEnd,
    giztokens_included: giztokensIncluded,
    included_cost_limit_cents: includedCostLimitCents,
    notes: `[${new Date().toISOString()}] Allowance mensal sincronizada pelo plano (${plan}).`,
  })

  if (error) throw error
}

async function resolveUserIdFromStripeObject(input: {
  metadata?: Stripe.Metadata | null
  clientReferenceId?: string | null
  customerId?: string | null
}) {
  const metadataUserId = input.metadata?.userId?.trim()
  if (metadataUserId) return metadataUserId
  if (input.clientReferenceId?.trim()) return input.clientReferenceId.trim()
  return null
}

export async function handleStripeCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = await resolveUserIdFromStripeObject({
    metadata: session.metadata,
    clientReferenceId: session.client_reference_id,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
  })
  if (!userId) return

  const planId = resolveBillingPlanId(session.metadata?.planId)
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!subscriptionId) {
    await upsertSubscriptionFromStripe({
      userId,
      planId,
      stripeSubscriptionId: session.id,
      status: 'trial',
      checkoutSessionUrl: session.url,
      note: `[${new Date().toISOString()}] Checkout concluído (${planId}).`,
    })
    return
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await upsertSubscriptionFromStripe({
    userId,
    planId: resolvePlanFromStripeSubscription(subscription),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    status: mapStripeSubscriptionStatus(subscription.status),
    trialExpiresAt: resolveTrialEnd(subscription),
    currentPeriodEnd: resolvePeriodEnd(subscription),
    checkoutSessionUrl: session.url,
    note: `[${new Date().toISOString()}] Checkout concluído (${planId}).`,
  })
}

export async function handleStripeSubscriptionEvent(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromStripeObject({
    metadata: subscription.metadata,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
  })
  if (!userId) return

  const planId = resolvePlanFromStripeSubscription(subscription)
  await upsertSubscriptionFromStripe({
    userId,
    planId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    status: mapStripeSubscriptionStatus(subscription.status),
    trialExpiresAt: resolveTrialEnd(subscription),
    currentPeriodEnd: resolvePeriodEnd(subscription),
    note: `[${new Date().toISOString()}] Assinatura Stripe ${subscription.status}.`,
  })
}

export async function handleStripeSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromStripeObject({
    metadata: subscription.metadata,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
  })
  if (!userId) return

  const supabase = createSupabaseServiceClient()
  const { data: current, error: selectError } = await supabase
    .from('subscriptions')
    .select('id,notes')
    .eq('user_id', userId)
    .maybeSingle()
  if (selectError) throw selectError

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled' satisfies SubscriptionStatus,
      notes: appendNote(current?.notes, `[${new Date().toISOString()}] Assinatura Stripe cancelada.`),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
}
