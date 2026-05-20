import { createSupabaseServiceClient } from './supabase-server'

export type AiGenerationType =
  | 'development_report'
  | 'classroom_journal'
  | 'class_diary'
  | 'planning_weekly'
  | 'weekly_planning'
  | 'planning_daily'
  | 'daily_lesson_plan'
  | 'planning_project'
  | 'pedagogical_project'
  | 'planning_meeting'
  | 'specialist_referral'
  | 'parents_meeting'
  | 'parents_meeting_record'
  | 'portfolio_text'
  | 'portfolio_image'
  | 'audio_transcription'
  | 'general_report'
  | 'planning'
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
  pricingOverride?: Partial<PricingEstimate>
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
  giztokensOverageLimit: number
  includedCostLimitCents: number
  includedCostUsedCents: number
  includedCostRemainingCents: number
  includedCostAlertCents: number
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

const GIZTOKENS_PER_COST_CENT = 10
const MONTHLY_INCLUDED_COST_CENTS = 600
const MONTHLY_COST_LIMIT_CENTS = 800
const MONTHLY_GIZTOKENS_DEFAULT = MONTHLY_INCLUDED_COST_CENTS * GIZTOKENS_PER_COST_CENT
const MONTHLY_GIZTOKEN_OVERAGE_LIMIT = (MONTHLY_COST_LIMIT_CENTS - MONTHLY_INCLUDED_COST_CENTS) * GIZTOKENS_PER_COST_CENT

/**
 * Estimativas de reserva para geração textual via pipeline Claude em 3 etapas (rascunho → BNCC/segurança → refinamento).
 * Tokens e custo são agregados conservadores (etapas 2–3 reenviam o texto anterior no prompt).
 * portfolio_image permanece no modelo de chamada única.
 */
const PRICING: Record<AiGenerationType, PricingEstimate> = {
  development_report: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(140),
    estimatedCostCents: 140,
    inputTokens: 10500,
    outputTokens: 5800,
    imageCount: 0,
  },
  class_diary: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(95),
    estimatedCostCents: 95,
    inputTokens: 6200,
    outputTokens: 2600,
    imageCount: 0,
  },
  classroom_journal: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(95),
    estimatedCostCents: 95,
    inputTokens: 6200,
    outputTokens: 2600,
    imageCount: 0,
  },
  weekly_planning: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(165),
    estimatedCostCents: 165,
    inputTokens: 11800,
    outputTokens: 7000,
    imageCount: 0,
  },
  planning_weekly: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(115),
    estimatedCostCents: 115,
    inputTokens: 8200,
    outputTokens: 3800,
    imageCount: 0,
  },
  daily_lesson_plan: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(120),
    estimatedCostCents: 120,
    inputTokens: 8600,
    outputTokens: 4200,
    imageCount: 0,
  },
  planning_daily: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(95),
    estimatedCostCents: 95,
    inputTokens: 6400,
    outputTokens: 3000,
    imageCount: 0,
  },
  pedagogical_project: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(190),
    estimatedCostCents: 190,
    inputTokens: 13200,
    outputTokens: 7600,
    imageCount: 0,
  },
  planning_project: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(190),
    estimatedCostCents: 190,
    inputTokens: 13200,
    outputTokens: 7600,
    imageCount: 0,
  },
  specialist_referral: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(135),
    estimatedCostCents: 135,
    inputTokens: 9100,
    outputTokens: 4600,
    imageCount: 0,
  },
  parents_meeting_record: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(105),
    estimatedCostCents: 105,
    inputTokens: 7200,
    outputTokens: 3200,
    imageCount: 0,
  },
  planning_meeting: {
    provider: 'anthropic',
    model: 'claude-text-2stage',
    giztokens: toGizTokens(105),
    estimatedCostCents: 105,
    inputTokens: 7200,
    outputTokens: 3200,
    imageCount: 0,
  },
  parents_meeting: {
    provider: 'anthropic',
    model: 'claude-text-1stage',
    giztokens: toGizTokens(75),
    estimatedCostCents: 75,
    inputTokens: 3600,
    outputTokens: 1800,
    imageCount: 0,
  },
  general_report: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(175),
    estimatedCostCents: 175,
    inputTokens: 12800,
    outputTokens: 7200,
    imageCount: 0,
  },
  planning: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(155),
    estimatedCostCents: 155,
    inputTokens: 11200,
    outputTokens: 6800,
    imageCount: 0,
  },
  portfolio_text: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(210),
    estimatedCostCents: 210,
    inputTokens: 13800,
    outputTokens: 8200,
    imageCount: 0,
  },
  portfolio_image: {
    provider: 'openai',
    model: resolvePortfolioImageEstimateModel(),
    giztokens: toGizTokens(resolvePortfolioImageEstimateCostCents()),
    estimatedCostCents: resolvePortfolioImageEstimateCostCents(),
    inputTokens: 1200,
    outputTokens: 0,
    imageCount: 1,
  },
  audio_transcription: {
    provider: 'openai',
    model: 'gpt-4o-mini-transcribe',
    giztokens: toGizTokens(2),
    estimatedCostCents: 2,
    inputTokens: 0,
    outputTokens: 0,
    imageCount: 0,
  },
  specialist_report: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(245),
    estimatedCostCents: 245,
    inputTokens: 15500,
    outputTokens: 8800,
    imageCount: 0,
  },
  other: {
    provider: 'anthropic',
    model: 'claude-text-3stage',
    giztokens: toGizTokens(145),
    estimatedCostCents: 145,
    inputTokens: 10000,
    outputTokens: 5600,
    imageCount: 0,
  },
}

/** Fallback quando o enum do banco ainda não tem o tipo novo (migration pendente). */
const GENERATION_TYPE_RPC_FALLBACK: Partial<Record<AiGenerationType, AiGenerationType>> = {
  classroom_journal: 'class_diary',
  planning_daily: 'daily_lesson_plan',
  planning_weekly: 'weekly_planning',
  planning_project: 'pedagogical_project',
  planning_meeting: 'parents_meeting_record',
  parents_meeting: 'parents_meeting_record',
  class_diary: 'general_report',
  weekly_planning: 'planning',
  daily_lesson_plan: 'planning',
  pedagogical_project: 'planning',
  specialist_referral: 'specialist_report',
  parents_meeting_record: 'general_report',
  audio_transcription: 'other',
}

export async function reserveAiUsage(input: AiUsageRequest): Promise<ReserveAiUsageResult> {
  const supabase = createSupabaseServiceClient()
  const baseEstimate = PRICING[input.generationType] ?? PRICING.other
  const estimate: PricingEstimate = {
    ...baseEstimate,
    ...input.pricingOverride,
    giztokens: typeof input.pricingOverride?.giztokens === 'number'
      ? clampNonNegativeInt(input.pricingOverride.giztokens)
      : baseEstimate.giztokens,
    estimatedCostCents: typeof input.pricingOverride?.estimatedCostCents === 'number'
      ? clampNonNegativeInt(input.pricingOverride.estimatedCostCents)
      : baseEstimate.estimatedCostCents,
    inputTokens: typeof input.pricingOverride?.inputTokens === 'number'
      ? clampNonNegativeInt(input.pricingOverride.inputTokens)
      : baseEstimate.inputTokens,
    outputTokens: typeof input.pricingOverride?.outputTokens === 'number'
      ? clampNonNegativeInt(input.pricingOverride.outputTokens)
      : baseEstimate.outputTokens,
    imageCount: typeof input.pricingOverride?.imageCount === 'number'
      ? clampNonNegativeInt(input.pricingOverride.imageCount)
      : baseEstimate.imageCount,
  }
  const { start: monthStart, end: monthEnd } = getMonthPeriod(new Date())
  const walletTargets = await resolveMonthlyWalletTargets(input.ownerId, monthStart, monthEnd)
  const entitlementType = getEntitlementType(input.generationType)

  const entitlementCycle = getEntitlementCycle(input.generationType, new Date())
  const entitlementIncludedQuantity = getIncludedEntitlementQuantity(input.generationType)

  const rpcParams = {
    p_owner_id: input.ownerId,
    p_class_id: input.classId ?? null,
    p_student_id: input.studentId ?? null,
    p_prompt_version: input.promptVersion ?? 'bncc-v1',
    p_request_summary: {
      ...(input.requestSummary ?? {}),
      requestedGenerationType: input.generationType,
    },
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
    p_monthly_giztokens_included: walletTargets.giztokensIncluded,
    p_included_cost_limit_cents: walletTargets.includedCostLimitCents,
    p_semester_cycle_label: entitlementCycle?.label ?? null,
    p_semester_cycle_start: entitlementCycle?.start ?? null,
    p_semester_cycle_end: entitlementCycle?.end ?? null,
    p_semester_included_quantity: entitlementIncludedQuantity,
  }

  let rpcGenerationType: AiGenerationType = input.generationType
  let { data, error } = await supabase.rpc('reserve_ai_usage_atomic', {
    ...rpcParams,
    p_generation_type: rpcGenerationType,
  })

  if (error && isInvalidGenerationTypeError(error)) {
    const fallbackType = GENERATION_TYPE_RPC_FALLBACK[input.generationType]
    if (fallbackType) {
      console.warn(
        `[ai-usage] tipo ${input.generationType} indisponivel no banco; reservando como ${fallbackType}`,
      )
      rpcGenerationType = fallbackType
      const retry = await supabase.rpc('reserve_ai_usage_atomic', {
        ...rpcParams,
        p_generation_type: rpcGenerationType,
      })
      data = retry.data
      error = retry.error
    }
  }

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
    giztokensRemaining: (result.wallet_giztokens_included ?? 0) - (result.wallet_giztokens_used ?? 0),
    giztokensOverageLimit: Math.max(
      0,
      (result.wallet_included_cost_limit_cents ?? 0) * GIZTOKENS_PER_COST_CENT - (result.wallet_giztokens_included ?? 0),
    ),
    includedCostLimitCents: result.wallet_included_cost_limit_cents ?? 0,
    includedCostUsedCents: result.wallet_included_cost_used_cents ?? 0,
    includedCostRemainingCents:
      (result.wallet_included_cost_limit_cents ?? 0) - (result.wallet_included_cost_used_cents ?? 0),
    includedCostAlertCents: Math.round((result.wallet_giztokens_included ?? 0) / GIZTOKENS_PER_COST_CENT),
  } : undefined

  const entitlementSummary: EntitlementSummary | undefined = result.entitlement_id ? {
    cycleLabel: result.entitlement_cycle_label ?? entitlementCycle?.label ?? '',
    includedQuantity: result.entitlement_included_quantity ?? entitlementIncludedQuantity,
    usedQuantity: result.entitlement_used_quantity ?? 0,
    remainingQuantity: Math.max(
      0,
      (result.entitlement_included_quantity ?? entitlementIncludedQuantity) - (result.entitlement_used_quantity ?? 0),
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
  if (generationType === 'general_report') return 'development_report'
  if (generationType === 'portfolio_image') return 'portfolio_image'
  return null
}

function getMonthPeriod(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}

function getEntitlementCycle(generationType: AiGenerationType, date: Date) {
  if (generationType === 'development_report') return getYearPeriod(date)
  if (generationType === 'general_report') return getYearPeriod(date)
  if (generationType === 'portfolio_image') return getMonthPeriodWithLabel(date)
  return null
}

function getIncludedEntitlementQuantity(generationType: AiGenerationType) {
  if (generationType === 'development_report') return 2
  if (generationType === 'general_report') return 2
  if (generationType === 'portfolio_image') return 2
  return 0
}

function getYearPeriod(date: Date) {
  const year = date.getFullYear()
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  return {
    start: formatDate(start),
    end: formatDate(end),
    label: `${year}`,
  }
}

function getMonthPeriodWithLabel(date: Date) {
  const { start, end } = getMonthPeriod(date)
  return { start, end, label: start.slice(0, 7) }
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isInvalidGenerationTypeError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  return /invalid input value for enum|ai_generation_type/i.test(message)
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

function toGizTokens(costCents: number) {
  return clampNonNegativeInt(costCents * GIZTOKENS_PER_COST_CENT)
}

function resolvePortfolioImageEstimateCostCents() {
  const fromEnv = Number(process.env.OPENAI_IMAGE_ESTIMATED_COST_CENTS ?? process.env.OPENAI_IMAGE_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return 80
}

function resolvePortfolioImageEstimateModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1'
}

async function resolveMonthlyWalletTargets(ownerId: string, monthStart: string, monthEnd: string) {
  const supabase = createSupabaseServiceClient()
  const { data: currentWallet, error: currentWalletError } = await supabase
    .from('ai_usage_wallets')
    .select('giztokens_included, included_cost_limit_cents')
    .eq('owner_id', ownerId)
    .eq('period_type', 'monthly')
    .eq('period_start', monthStart)
    .eq('period_end', monthEnd)
    .maybeSingle()

  if (currentWalletError) {
    throw toError(currentWalletError, 'Nao foi possivel ler a carteira mensal atual de IA.')
  }

  if (currentWallet) {
    return {
      giztokensIncluded: clampNonNegativeInt(currentWallet.giztokens_included ?? MONTHLY_GIZTOKENS_DEFAULT),
      includedCostLimitCents: clampNonNegativeInt(currentWallet.included_cost_limit_cents ?? MONTHLY_COST_LIMIT_CENTS),
    }
  }

  const { data: previousWalletRows, error: previousWalletError } = await supabase
    .from('ai_usage_wallets')
    .select('giztokens_included, included_cost_used_cents, period_end')
    .eq('owner_id', ownerId)
    .eq('period_type', 'monthly')
    .lt('period_end', monthStart)
    .order('period_end', { ascending: false })
    .limit(1)

  if (previousWalletError) {
    throw toError(previousWalletError, 'Nao foi possivel ler a carteira mensal anterior de IA.')
  }

  const previousWallet = previousWalletRows?.[0]
  if (!previousWallet) {
    return {
      giztokensIncluded: MONTHLY_GIZTOKENS_DEFAULT,
      includedCostLimitCents: MONTHLY_COST_LIMIT_CENTS,
    }
  }

  const previousIncludedCostCents = Math.max(
    0,
    Math.round((previousWallet.giztokens_included ?? MONTHLY_GIZTOKENS_DEFAULT) / GIZTOKENS_PER_COST_CENT),
  )
  const previousUsedCostCents = clampNonNegativeInt(previousWallet.included_cost_used_cents ?? 0)
  const previousNegativeCostCents = Math.max(0, previousUsedCostCents - previousIncludedCostCents)
  const maxOverageCostCents = Math.max(0, MONTHLY_COST_LIMIT_CENTS - MONTHLY_INCLUDED_COST_CENTS)
  const carryoverCostCents = Math.min(previousNegativeCostCents, maxOverageCostCents)

  return {
    giztokensIncluded: toGizTokens(Math.max(0, MONTHLY_INCLUDED_COST_CENTS - carryoverCostCents)),
    includedCostLimitCents: Math.max(0, MONTHLY_COST_LIMIT_CENTS - carryoverCostCents),
  }
}
