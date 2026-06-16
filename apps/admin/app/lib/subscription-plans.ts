export type BillingPlanId = 'monthly' | 'semiannual' | 'annual'

export type BillingPlanConfig = {
  id: BillingPlanId
  label: string
  stripePriceEnv: 'STRIPE_PRICE_MONTHLY' | 'STRIPE_PRICE_SEMIANNUAL' | 'STRIPE_PRICE_ANNUAL'
  giztokensMonthly: number
  trialDays: number
  /** Valor total cobrado no ciclo (centavos BRL). */
  totalAmountCents: number
  /** Valor mensal equivalente para exibição (centavos BRL). */
  displayMonthlyCents: number
  compareMonthlyCents: number
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanConfig> = {
  monthly: {
    id: 'monthly',
    label: 'Mensal',
    stripePriceEnv: 'STRIPE_PRICE_MONTHLY',
    giztokensMonthly: 8000,
    trialDays: 7,
    totalAmountCents: 3990,
    displayMonthlyCents: 3990,
    compareMonthlyCents: 4990,
  },
  semiannual: {
    id: 'semiannual',
    label: 'Semestral',
    stripePriceEnv: 'STRIPE_PRICE_SEMIANNUAL',
    giztokensMonthly: 9000,
    trialDays: 7,
    totalAmountCents: 20940,
    displayMonthlyCents: 3490,
    compareMonthlyCents: 4990,
  },
  annual: {
    id: 'annual',
    label: 'Anual',
    stripePriceEnv: 'STRIPE_PRICE_ANNUAL',
    giztokensMonthly: 10000,
    trialDays: 7,
    totalAmountCents: 35880,
    displayMonthlyCents: 2990,
    compareMonthlyCents: 4990,
  },
}

const PLAN_ALIASES: Record<string, BillingPlanId> = {
  monthly: 'monthly',
  mensal: 'monthly',
  month: 'monthly',
  semiannual: 'semiannual',
  semestral: 'semiannual',
  'semi-annual': 'semiannual',
  annual: 'annual',
  anual: 'annual',
  yearly: 'annual',
}

export function normalizeBillingPlanId(value: string | null | undefined): BillingPlanId | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return PLAN_ALIASES[normalized] ?? null
}

export function resolveBillingPlanId(value: string | null | undefined, fallback: BillingPlanId = 'monthly'): BillingPlanId {
  return normalizeBillingPlanId(value) ?? fallback
}

export function getBillingPlan(planId: BillingPlanId): BillingPlanConfig {
  return BILLING_PLANS[planId]
}

export function getStripePriceId(planId: BillingPlanId): string {
  const plan = getBillingPlan(planId)
  const priceId = process.env[plan.stripePriceEnv]?.trim()
  if (!priceId) {
    throw new Error(`Variável ${plan.stripePriceEnv} não configurada para o plano ${planId}.`)
  }
  return priceId
}

export function getGiztokensMonthlyForPlan(plan: string | null | undefined): number {
  const planId = normalizeBillingPlanId(plan)
  if (!planId) return BILLING_PLANS.monthly.giztokensMonthly
  return getBillingPlan(planId).giztokensMonthly
}

export function isPaidBillingPlan(plan: string | null | undefined): boolean {
  return normalizeBillingPlanId(plan) != null
}

export function listBillingPlanIds(): BillingPlanId[] {
  return ['monthly', 'semiannual', 'annual']
}
