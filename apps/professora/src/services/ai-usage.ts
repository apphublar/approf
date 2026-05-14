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
    includedCostRemainingCents: number
  }
  entitlement?: {
    usedQuantity: number
    includedQuantity: number
  }
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
