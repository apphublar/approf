import { getSupabaseClient } from './supabase/client'

export type AiGenerationType =
  | 'development_report'
  | 'general_report'
  | 'planning'
  | 'portfolio_text'
  | 'portfolio_image'
  | 'specialist_report'
  | 'other'

export interface AiUsageReservationInput {
  generationType: AiGenerationType
  classId?: string | null
  studentId?: string | null
  promptVersion?: string
  requestSummary?: Record<string, unknown>
}

export interface AiUsageReservationResult {
  allowed: boolean
  message: string
  chargeSource?: 'giztokens' | 'semester_entitlement' | 'paid_extra'
  wallet?: {
    giztokensRemaining: number
    giztokensOverageLimit?: number
    includedCostRemainingCents: number
    includedCostAlertCents?: number
  }
  entitlement?: {
    usedQuantity: number
    includedQuantity: number
  }
}

export interface AiTextGenerationInput extends AiUsageReservationInput {
  requestSummary?: Record<string, unknown>
}

export interface AiTextGenerationResult extends AiUsageReservationResult {
  generatedText?: string
  reportId?: string
  promptVersion?: string
  provider?: string
  model?: string
}

export interface AiImageGenerationInput extends AiUsageReservationInput {
  requestSummary?: Record<string, unknown>
}

export interface AiImageGenerationResult extends AiUsageReservationResult {
  imageDataUrl?: string
  prompt?: string
  reportId?: string
  promptVersion?: string
  provider?: string
  model?: string
}

export interface AiUsageSummary {
  wallet: {
    giztokensIncluded: number
    giztokensUsed: number
    giztokensRemaining: number
    giztokensOverageLimit: number
    includedCostLimitCents: number
    includedCostUsedCents: number
    includedCostRemainingCents: number
    includedCostAlertCents: number
    periodStart: string | null
    periodEnd: string | null
  }
  entitlements: Array<{
    entitlementType: string
    cycleLabel: string
    studentId: string | null
    classId: string | null
    includedQuantity: number
    usedQuantity: number
    remainingQuantity: number
  }>
  generatedThisMonth: number
  recentUsage?: Array<{
    id: string
    generationType: AiGenerationType
    status: 'estimated' | 'completed' | 'failed' | 'refunded'
    provider: string
    model: string
    chargeSource: 'giztokens' | 'semester_entitlement' | 'paid_extra'
    studentId: string | null
    classId: string | null
    reportId: string | null
    giztokensCharged: number
    estimatedCostCents: number
    actualCostCents: number
    createdAt: string
  }>
}

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de IA nao configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase nao configurado para consultar uso de IA.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para consultar uso de IA.')
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/usage-summary`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json().catch(() => null) as AiUsageSummary | { error?: string } | null

  if (!response.ok) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Nao foi possivel consultar o saldo de IA.'
    throw new Error(message)
  }

  if (!result || !('wallet' in result)) {
    throw new Error('Resposta invalida do backend de IA.')
  }

  return result
}

export async function reserveAiUsage(input: AiUsageReservationInput): Promise<AiUsageReservationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')

  if (!apiBaseUrl) {
    throw new Error('Backend de IA nao configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase nao configurado para registrar uso de IA.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para gerar com IA.')
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/reserve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => null) as Partial<AiUsageReservationResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Nao foi possivel registrar o uso de IA.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta invalida do backend de IA.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
  }
}

export async function generateAiTextDocument(input: AiTextGenerationInput): Promise<AiTextGenerationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de IA nao configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase nao configurado para registrar uso de IA.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para gerar com IA.')
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/generate-text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => null) as Partial<AiTextGenerationResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Nao foi possivel gerar documento com IA.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta invalida do backend de IA.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    generatedText: typeof result.generatedText === 'string' ? result.generatedText : undefined,
    reportId: typeof result.reportId === 'string' ? result.reportId : undefined,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : undefined,
    provider: typeof result.provider === 'string' ? result.provider : undefined,
    model: typeof result.model === 'string' ? result.model : undefined,
  }
}

export async function generateAiPortfolioImage(input: AiImageGenerationInput): Promise<AiImageGenerationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de IA nao configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase nao configurado para registrar uso de IA.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para gerar com IA.')
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/generate-portfolio-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => null) as Partial<AiImageGenerationResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Nao foi possivel gerar imagem com IA.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta invalida do backend de IA.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    imageDataUrl: typeof result.imageDataUrl === 'string' ? result.imageDataUrl : undefined,
    prompt: typeof result.prompt === 'string' ? result.prompt : undefined,
    reportId: typeof result.reportId === 'string' ? result.reportId : undefined,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : undefined,
    provider: typeof result.provider === 'string' ? result.provider : undefined,
    model: typeof result.model === 'string' ? result.model : undefined,
  }
}

export function formatAiUsageMessage(result: AiUsageReservationResult) {
  if (!result.allowed) return result.message || 'Esta geracao precisa de pacote extra.'

  if (result.chargeSource === 'semester_entitlement' && result.entitlement) {
    return `Cota semestral usada: ${result.entitlement.usedQuantity}/${result.entitlement.includedQuantity}.`
  }

  if (result.wallet) {
    return `GizTokens restantes: ${result.wallet.giztokensRemaining}.`
  }

  return result.message || 'Uso de IA registrado.'
}
