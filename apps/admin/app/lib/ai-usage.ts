import { createSupabaseServiceClient } from './supabase-server'

export type AiGenerationType =
  | 'development_report'
  | 'general_report'
  | 'planning'
  | 'portfolio_text'
  | 'portfolio_image'
  | 'specialist_report'
  | 'other'

type ChargeSource = 'giztokens' | 'semester_entitlement' | 'paid_extra'
type EntitlementType = 'development_report' | 'portfolio_image'

interface AiUsageRequest {
  ownerId: string
  generationType: AiGenerationType
  classId?: string | null
  studentId?: string | null
  promptVersion?: string
  requestSummary?: Record<string, unknown>
}

interface PricingEstimate {
  provider: string
  model: string
  giztokens: number
  estimatedCostCents: number
  inputTokens: number
  outputTokens: number
  imageCount: number
}

const MONTHLY_GIZTOKENS_DEFAULT = 1000
const INCLUDED_COST_LIMIT_CENTS = 10000

const PRICING: Record<AiGenerationType, PricingEstimate> = {
  development_report: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 45,
    estimatedCostCents: 35,
    inputTokens: 2500,
    outputTokens: 1800,
    imageCount: 0,
  },
  general_report: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 60,
    estimatedCostCents: 45,
    inputTokens: 3000,
    outputTokens: 2200,
    imageCount: 0,
  },
  planning: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 55,
    estimatedCostCents: 40,
    inputTokens: 2600,
    outputTokens: 2100,
    imageCount: 0,
  },
  portfolio_text: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 70,
    estimatedCostCents: 55,
    inputTokens: 3200,
    outputTokens: 2600,
    imageCount: 0,
  },
  portfolio_image: {
    provider: 'openai',
    model: 'chatgpt-image',
    giztokens: 220,
    estimatedCostCents: 100,
    inputTokens: 1200,
    outputTokens: 0,
    imageCount: 1,
  },
  specialist_report: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 80,
    estimatedCostCents: 65,
    inputTokens: 3600,
    outputTokens: 2800,
    imageCount: 0,
  },
  other: {
    provider: 'anthropic',
    model: 'claude-text',
    giztokens: 50,
    estimatedCostCents: 40,
    inputTokens: 2400,
    outputTokens: 1800,
    imageCount: 0,
  },
}

export async function reserveAiUsage(input: AiUsageRequest) {
  const supabase = createSupabaseServiceClient()
  const estimate = PRICING[input.generationType] ?? PRICING.other
  const { start: monthStart, end: monthEnd } = getMonthPeriod(new Date())
  const wallet = await ensureMonthlyWallet(input.ownerId, monthStart, monthEnd)
  const nextCost = wallet.included_cost_used_cents + estimate.estimatedCostCents

  if (nextCost > wallet.included_cost_limit_cents) {
    return {
      allowed: false,
      reason: 'included_cost_limit_reached',
      message: 'Seu uso incluso do periodo foi concluido. Para continuar, compre um pacote extra de GizTokens.',
      estimate,
      wallet: summarizeWallet(wallet),
    }
  }

  const remainingGiztokens = wallet.giztokens_included - wallet.giztokens_used
  if (remainingGiztokens >= estimate.giztokens) {
    const { data: updatedWallet, error: walletError } = await supabase
      .from('ai_usage_wallets')
      .update({
        giztokens_used: wallet.giztokens_used + estimate.giztokens,
        included_cost_used_cents: nextCost,
      })
      .eq('id', wallet.id)
      .select('*')
      .single()

    if (walletError) throw toError(walletError, 'Nao foi possivel reservar GizTokens.')
    const log = await createGenerationLog(input, estimate, 'giztokens', updatedWallet.id)
    return {
      allowed: true,
      chargeSource: 'giztokens' as const,
      logId: log.id,
      estimate,
      wallet: summarizeWallet(updatedWallet),
    }
  }

  const entitlementType = getEntitlementType(input.generationType)
  if (entitlementType && input.studentId) {
    const entitlement = await ensureSemesterEntitlement({
      ownerId: input.ownerId,
      classId: input.classId ?? null,
      studentId: input.studentId,
      entitlementType,
    })

    if (entitlement.used_quantity < entitlement.included_quantity) {
      const { data: updatedEntitlement, error: entitlementError } = await supabase
        .from('ai_semester_entitlements')
        .update({ used_quantity: entitlement.used_quantity + 1 })
        .eq('id', entitlement.id)
        .select('*')
        .single()

      if (entitlementError) throw toError(entitlementError, 'Nao foi possivel usar a cota semestral.')

      const { data: updatedWallet, error: walletError } = await supabase
        .from('ai_usage_wallets')
        .update({ included_cost_used_cents: nextCost })
        .eq('id', wallet.id)
        .select('*')
        .single()

      if (walletError) throw toError(walletError, 'Nao foi possivel registrar custo da cota semestral.')
      const log = await createGenerationLog(input, estimate, 'semester_entitlement', updatedWallet.id, updatedEntitlement.id)

      return {
        allowed: true,
        chargeSource: 'semester_entitlement' as const,
        logId: log.id,
        estimate,
        wallet: summarizeWallet(updatedWallet),
        entitlement: summarizeEntitlement(updatedEntitlement),
      }
    }
  }

  return {
    allowed: false,
    reason: 'paid_extra_required',
    message: 'Seu saldo incluso para esta geracao acabou. Escolha um pacote extra para continuar.',
    estimate,
    wallet: summarizeWallet(wallet),
  }
}

async function ensureMonthlyWallet(ownerId: string, periodStart: string, periodEnd: string) {
  const supabase = createSupabaseServiceClient()
  const { data: existing, error: selectError } = await supabase
    .from('ai_usage_wallets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('period_type', 'monthly')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  if (selectError) throw toError(selectError, 'Nao foi possivel carregar carteira de GizTokens.')
  if (existing) return existing

  const { data, error } = await supabase
    .from('ai_usage_wallets')
    .insert({
      owner_id: ownerId,
      period_type: 'monthly',
      period_start: periodStart,
      period_end: periodEnd,
      giztokens_included: MONTHLY_GIZTOKENS_DEFAULT,
      included_cost_limit_cents: INCLUDED_COST_LIMIT_CENTS,
    })
    .select('*')
    .single()

  if (error) throw toError(error, 'Nao foi possivel criar carteira de GizTokens.')
  return data
}

async function ensureSemesterEntitlement(input: {
  ownerId: string
  classId: string | null
  studentId: string
  entitlementType: EntitlementType
}) {
  const supabase = createSupabaseServiceClient()
  const cycle = getSemesterPeriod(new Date())
  const includedQuantity = input.entitlementType === 'development_report' ? 2 : 1

  const { data: existing, error: selectError } = await supabase
    .from('ai_semester_entitlements')
    .select('*')
    .eq('owner_id', input.ownerId)
    .eq('student_id', input.studentId)
    .eq('entitlement_type', input.entitlementType)
    .eq('cycle_start', cycle.start)
    .eq('cycle_end', cycle.end)
    .maybeSingle()

  if (selectError) throw toError(selectError, 'Nao foi possivel carregar cota semestral.')
  if (existing) return existing

  const { data, error } = await supabase
    .from('ai_semester_entitlements')
    .insert({
      owner_id: input.ownerId,
      class_id: input.classId,
      student_id: input.studentId,
      entitlement_type: input.entitlementType,
      cycle_label: cycle.label,
      cycle_start: cycle.start,
      cycle_end: cycle.end,
      included_quantity: includedQuantity,
    })
    .select('*')
    .single()

  if (error) throw toError(error, 'Nao foi possivel criar cota semestral.')
  return data
}

async function createGenerationLog(
  input: AiUsageRequest,
  estimate: PricingEstimate,
  chargeSource: ChargeSource,
  walletId: string,
  entitlementId?: string,
) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('ai_generation_logs')
    .insert({
      owner_id: input.ownerId,
      class_id: input.classId ?? null,
      student_id: input.studentId ?? null,
      wallet_id: walletId,
      entitlement_id: entitlementId ?? null,
      generation_type: input.generationType,
      provider: estimate.provider,
      model: estimate.model,
      charge_source: chargeSource,
      status: 'estimated',
      input_tokens: estimate.inputTokens,
      output_tokens: estimate.outputTokens,
      image_count: estimate.imageCount,
      giztokens_charged: chargeSource === 'giztokens' ? estimate.giztokens : 0,
      estimated_cost_cents: estimate.estimatedCostCents,
      prompt_version: input.promptVersion ?? 'bncc-v1',
      request_summary: input.requestSummary ?? {},
    })
    .select('id')
    .single()

  if (error) throw toError(error, 'Nao foi possivel registrar uso de IA.')
  return data
}

function getEntitlementType(generationType: AiGenerationType): EntitlementType | null {
  if (generationType === 'development_report') return 'development_report'
  if (generationType === 'portfolio_image') return 'portfolio_image'
  return null
}

function getMonthPeriod(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}

function getSemesterPeriod(date: Date) {
  const firstSemester = date.getMonth() < 6
  const year = date.getFullYear()
  const start = new Date(year, firstSemester ? 0 : 6, 1)
  const end = new Date(year, firstSemester ? 5 : 11, firstSemester ? 30 : 31)
  return {
    start: formatDate(start),
    end: formatDate(end),
    label: `${year}.${firstSemester ? '1' : '2'}`,
  }
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function summarizeWallet(wallet: {
  giztokens_included: number
  giztokens_used: number
  included_cost_limit_cents: number
  included_cost_used_cents: number
}) {
  return {
    giztokensIncluded: wallet.giztokens_included,
    giztokensUsed: wallet.giztokens_used,
    giztokensRemaining: Math.max(0, wallet.giztokens_included - wallet.giztokens_used),
    includedCostLimitCents: wallet.included_cost_limit_cents,
    includedCostUsedCents: wallet.included_cost_used_cents,
    includedCostRemainingCents: Math.max(0, wallet.included_cost_limit_cents - wallet.included_cost_used_cents),
  }
}

function summarizeEntitlement(entitlement: {
  included_quantity: number
  used_quantity: number
  cycle_label: string
}) {
  return {
    cycleLabel: entitlement.cycle_label,
    includedQuantity: entitlement.included_quantity,
    usedQuantity: entitlement.used_quantity,
    remainingQuantity: Math.max(0, entitlement.included_quantity - entitlement.used_quantity),
  }
}

function toError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallbackMessage)
}
