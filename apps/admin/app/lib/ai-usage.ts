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

interface WalletSummary {
  giztokensIncluded: number
  giztokensUsed: number
  giztokensRemaining: number
  includedCostLimitCents: number
  includedCostUsedCents: number
  includedCostRemainingCents: number
}

interface EntitlementSummary {
  cycleLabel: string
  includedQuantity: number
  usedQuantity: number
  remainingQuantity: number
}

interface ReserveAiUsageResult {
  allowed: boolean
  reason?: 'included_cost_limit_reached' | 'paid_extra_required'
  message: string
  chargeSource?: ChargeSource
  logId?: string
  estimate?: PricingEstimate
  wallet?: WalletSummary
  entitlement?: EntitlementSummary
}

const MONTHLY_GIZTOKENS_DEFAULT = 1000
const INCLUDED_COST_LIMIT_CENTS = 10000

/**
 * Estimativas de reserva para geração textual via pipeline Claude em 3 etapas (rascunho → BNCC/segurança → refinamento).
 * Tokens e custo são agregados conservadores (etapas 2–3 reenviam o texto anterior no prompt).
 * portfolio_image permanece no modelo de chamada única.
 */
const PRICING: Record<AiGenerationType, PricingEstimate> = {
  development_report: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: 115,
    estimatedCostCents: 140,
    inputTokens: 10500,
    outputTokens: 5800,
    imageCount: 0,
  },
  general_report: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: 155,
    estimatedCostCents: 175,
    inputTokens: 12800,
    outputTokens: 7200,
    imageCount: 0,
  },
  planning: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: 145,
    estimatedCostCents: 155,
    inputTokens: 11200,
    outputTokens: 6800,
    imageCount: 0,
  },
  portfolio_text: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: 185,
    estimatedCostCents: 210,
    inputTokens: 13800,
    outputTokens: 8200,
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
    model: 'claude-text-3stage',
    giztokens: 205,
    estimatedCostCents: 245,
    inputTokens: 15500,
    outputTokens: 8800,
    imageCount: 0,
  },
  other: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: 130,
    estimatedCostCents: 145,
    inputTokens: 10000,
    outputTokens: 5600,
    imageCount: 0,
  },
}

export async function reserveAiUsage(input: AiUsageRequest): Promise<ReserveAiUsageResult> {
  const supabase = createSupabaseServiceClient()
  const estimate = PRICING[input.generationType] ?? PRICING.other
  const { start: monthStart, end: monthEnd } = getMonthPeriod(new Date())
  const entitlementType = getEntitlementType(input.generationType)

  const semester = getSemesterPeriod(new Date())
  const semesterIncludedQuantity = entitlementType === 'development_report' ? 2 : 1

  const { data, error } = await supabase.rpc('reserve_ai_usage_atomic', {
    p_owner_id: input.ownerId,
    p_generation_type: input.generationType,
    p_class_id: input.classId ?? null,
    p_student_id: input.studentId ?? null,
    p_prompt_version: input.promptVersion ?? 'bncc-v1',
    p_request_summary: input.requestSummary ?? {},
    p_provider: estimate.provider,
    p_model: estimate.model,
    p_estimated_cost_cents: estimate.estimatedCostCents,
    p_estimated_input_tokens: estimate.inputTokens,
    p_estimated_output_tokens: estimate.outputTokens,
    p_estimated_image_count: estimate.imageCount,
    p_giztokens_cost: estimate.giztokens,
    p_entitlement_type: entitlementType,
    p_month_period_start: monthStart,
    p_month_period_end: monthEnd,
    p_monthly_giztokens_included: MONTHLY_GIZTOKENS_DEFAULT,
    p_included_cost_limit_cents: INCLUDED_COST_LIMIT_CENTS,
    p_semester_cycle_label: semester.label,
    p_semester_cycle_start: semester.start,
    p_semester_cycle_end: semester.end,
    p_semester_included_quantity: semesterIncludedQuantity,
  })

  if (error) {
    throw toError(error, 'Nao foi possivel reservar uso de IA.')
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result) {
    throw new Error('Resposta invalida ao reservar uso de IA.')
  }

  const walletSummary: WalletSummary | undefined = result.wallet_id ? {
    giztokensIncluded: result.wallet_giztokens_included ?? 0,
    giztokensUsed: result.wallet_giztokens_used ?? 0,
    giztokensRemaining: Math.max(0, (result.wallet_giztokens_included ?? 0) - (result.wallet_giztokens_used ?? 0)),
    includedCostLimitCents: result.wallet_included_cost_limit_cents ?? 0,
    includedCostUsedCents: result.wallet_included_cost_used_cents ?? 0,
    includedCostRemainingCents: Math.max(
      0,
      (result.wallet_included_cost_limit_cents ?? 0) - (result.wallet_included_cost_used_cents ?? 0),
    ),
  } : undefined

  const entitlementSummary: EntitlementSummary | undefined = result.entitlement_id ? {
    cycleLabel: result.entitlement_cycle_label ?? semester.label,
    includedQuantity: result.entitlement_included_quantity ?? semesterIncludedQuantity,
    usedQuantity: result.entitlement_used_quantity ?? 0,
    remainingQuantity: Math.max(
      0,
      (result.entitlement_included_quantity ?? semesterIncludedQuantity) - (result.entitlement_used_quantity ?? 0),
    ),
  } : undefined

  return {
    allowed: Boolean(result.allowed),
    reason: result.reason ?? undefined,
    message: typeof result.message === 'string' ? result.message : 'Nao foi possivel reservar uso de IA.',
    chargeSource: result.charge_source ?? undefined,
    logId: result.log_id ?? undefined,
    estimate,
    wallet: walletSummary,
    entitlement: entitlementSummary,
  }
}

export async function completeAiUsageReservation(input: {
  logId: string
  actualCostCents: number
  resultSummary?: Record<string, unknown>
}) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('finalize_ai_usage_reservation', {
    p_log_id: input.logId,
    p_actual_cost_cents: clampNonNegativeInt(input.actualCostCents),
    p_result_summary: input.resultSummary ?? {},
  })

  if (error) {
    throw toError(error, 'Nao foi possivel finalizar a geracao de IA.')
  }

  const result = Array.isArray(data) ? data[0] : data
  if (result?.status === 'refunded') {
    throw new Error('A reserva desta geracao ja foi estornada.')
  }
}

export async function refundAiUsageReservation(input: {
  logId: string
  reason: string
  markAsFailed?: boolean
  reservedCostCentsOverride?: number
}) {
  const supabase = createSupabaseServiceClient()
  const status = input.markAsFailed ? 'failed' : 'refunded'
  const { error } = await supabase.rpc('refund_ai_usage_reservation', {
    p_log_id: input.logId,
    p_reason: input.reason,
    p_status: status,
    p_reserved_cost_override:
      typeof input.reservedCostCentsOverride === 'number'
        ? clampNonNegativeInt(input.reservedCostCentsOverride)
        : null,
  })

  if (error) {
    throw toError(error, 'Nao foi possivel registrar estorno da geracao.')
  }
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

function toError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallbackMessage)
}

function clampNonNegativeInt(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}
