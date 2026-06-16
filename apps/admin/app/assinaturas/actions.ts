'use server'

import { redirect } from 'next/navigation'
import { requireAdminSession } from '../lib/admin-auth'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { tryGrantReferralReward } from '@/app/lib/referrals'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'
type SubscriptionRow = {
  id: string
  user_id: string
  status: SubscriptionStatus
  plan: string
  current_period_end: string | null
  notes: string | null
}

const planOptions = [
  { value: 'free', label: 'Gratuito' },
  { value: 'trial_7_days', label: 'Teste 7 dias' },
  { value: 'trial_15_days', label: 'Teste 15 dias' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'verification_required', label: 'Em analise' },
]

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: 'trial', label: 'Teste' },
  { value: 'active', label: 'Ativa' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'canceled', label: 'Cancelada' },
]

export async function liberarAcessoGratuito(formData: FormData) {
  const admin = await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  if (!teacherId) return

  const supabase = createSupabaseServiceClient()

  // 1. Activate free subscription
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: teacherId,
        status: 'active',
        plan: 'free',
        provider: 'manual',
        external_reference: null,
        trial_expires_at: null,
        current_period_end: null,
        notes: 'Acesso gratuito liberado pelo admin.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (subError) throw new Error(`Subscriptions error: ${subError.message}`)

  // 2. Approve or create verification record
  const { data: existing } = await supabase
    .from('teacher_profile_verifications')
    .select('id')
    .eq('owner_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error: verErr } = await supabase
      .from('teacher_profile_verifications')
      .update({ status: 'approved', notes: 'Aprovado automaticamente junto com liberação de acesso gratuito.', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (verErr) throw new Error(`Verification update error: ${verErr.message}`)
  } else {
    const { error: verErr } = await supabase
      .from('teacher_profile_verifications')
      .insert({
        owner_id: teacherId,
        status: 'approved',
        notes: 'Aprovado automaticamente junto com liberação de acesso gratuito.',
        school_ids: [],
        documents: [],
      })
    if (verErr) throw new Error(`Verification insert error: ${verErr.message}`)
  }

  // 3. Log the action
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'teacher_access_granted_free',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status: 'active', plan: 'free', verification: 'approved' },
  })

  redirect('/assinaturas')
}

export async function sendPaymentOverdueNotice(formData: FormData) {
  await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  if (!teacherId) return
  await createPaymentNotice([teacherId])
  redirect('/assinaturas')
}

export async function sendAllPaymentOverdueNotices() {
  await requireAdminSession()
  const supabase = createSupabaseServiceClient()
  const overdue = await listOverdueSubscriptions(supabase)
  await createPaymentNotice(overdue.map((item) => item.user_id))
  redirect('/assinaturas')
}

export async function blockTeacherAccess(formData: FormData) {
  await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  if (!teacherId) return
  await blockSubscriptions([teacherId], 'Bloqueio manual individual pelo admin.')
  redirect('/assinaturas')
}

export async function blockAllOverdueAccess() {
  await requireAdminSession()
  const supabase = createSupabaseServiceClient()
  const overdue = await listOverdueSubscriptions(supabase)
  await blockSubscriptions(overdue.map((item) => item.user_id), 'Bloqueio manual em massa de contas em atraso pelo admin.')
  redirect('/assinaturas')
}

export async function updateTeacherSubscription(formData: FormData) {
  const admin = await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as SubscriptionStatus
  const plan = String(formData.get('plan') ?? '').trim()
  const paymentLink = String(formData.get('paymentLink') ?? '').trim()
  const currentPeriodEnd = String(formData.get('currentPeriodEnd') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!teacherId || !statusOptions.some((o) => o.value === status)) return
  if (!planOptions.some((o) => o.value === plan)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: teacherId,
        status,
        plan,
        provider: 'manual',
        external_reference: plan === 'free' ? null : paymentLink || null,
        trial_expires_at:
          (plan === 'trial_7_days' || plan === 'trial_15_days') && currentPeriodEnd
            ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString()
            : null,
        current_period_end:
          plan !== 'free' && currentPeriodEnd
            ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString()
            : null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(`Subscriptions error: ${error.message}`)

  if (status === 'active' && ['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(plan.toLowerCase())) {
    await tryGrantReferralReward(teacherId)
  }

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'teacher_subscription_updated',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status, plan, paymentLink: paymentLink || null, currentPeriodEnd: currentPeriodEnd || null },
  })

  redirect('/assinaturas')
}

async function createPaymentNotice(teacherIds: string[]) {
  const uniqueIds = Array.from(new Set(teacherIds.filter(Boolean)))
  if (!uniqueIds.length) return

  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from('notification_events').insert(
    uniqueIds.map((teacherId) => ({
      user_id: teacherId,
      channel: 'system',
      type: 'payment_overdue_notice',
      status: 'sent',
      sent_at: now,
      payload: {
        title: 'Pagamento em atraso',
        message: 'Identificamos uma pendencia no pagamento do Approf. O acesso continua liberado por enquanto, mas regularize para evitar bloqueio manual pelo admin.',
      },
    })),
  )
  if (error) throw new Error(`Notification error: ${error.message}`)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_payment_overdue_notice_sent',
    target_table: 'notification_events',
    target_id: null,
    metadata: { teacherIds: uniqueIds },
  })
}

async function blockSubscriptions(teacherIds: string[], note: string) {
  const uniqueIds = Array.from(new Set(teacherIds.filter(Boolean)))
  if (!uniqueIds.length) return

  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()
  const { data: current, error: selectError } = await supabase
    .from('subscriptions')
    .select('user_id, notes')
    .in('user_id', uniqueIds)
  if (selectError) throw new Error(`Subscriptions select error: ${selectError.message}`)

  const currentByUser = new Map((current ?? []).map((item) => [item.user_id, item.notes as string | null]))
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      uniqueIds.map((teacherId) => ({
        user_id: teacherId,
        status: 'blocked',
        provider: 'manual',
        notes: appendNote(currentByUser.get(teacherId) ?? null, note),
        updated_at: now,
      })),
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(`Subscriptions block error: ${error.message}`)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_access_blocked_manual',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherIds: uniqueIds, note },
  })
}

async function listOverdueSubscriptions(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, plan, current_period_end, notes')
  if (error) throw new Error(`Subscriptions overdue error: ${error.message}`)
  return ((data ?? []) as SubscriptionRow[]).filter(isPaymentOverdue)
}

function isPaymentOverdue(subscription: SubscriptionRow) {
  if (subscription.status === 'blocked' || subscription.status === 'canceled') return false
  if (subscription.status === 'overdue') return true
  if (!['monthly', 'semiannual', 'annual'].includes(subscription.plan)) return false
  if (!subscription.current_period_end) return false
  return new Date(subscription.current_period_end).getTime() < Date.now()
}

function appendNote(current: string | null, note: string) {
  return [current, `[${new Date().toISOString()}] ${note}`].filter(Boolean).join('\n').slice(0, 2000)
}
