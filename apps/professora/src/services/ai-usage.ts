import { getSupabaseClient } from './supabase/client'

export type AiGenerationType =
  | 'development_report'
  | 'class_diary'
  | 'weekly_planning'
  | 'daily_lesson_plan'
  | 'pedagogical_project'
  | 'specialist_referral'
  | 'parents_meeting_record'
  | 'portfolio_text'
  | 'portfolio_image'
  | 'audio_transcription'
  | 'general_report'
  | 'planning'
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
  quality?: 'standard' | 'medium' | 'high'
  reportId?: string
  promptVersion?: string
  provider?: string
  model?: string
}

export interface GeneratedImageInput {
  description: string
  quality?: 'standard' | 'medium' | 'high'
  classId?: string | null
  studentId?: string | null
}

export interface AiChatGenerationInput {
  provider: 'openai' | 'anthropic'
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  classId?: string | null
  studentId?: string | null
  requestSummary?: Record<string, unknown>
}

export interface AiChatGenerationResult extends AiUsageReservationResult {
  response?: string
  provider?: string
  model?: string
}

export interface AiAudioTranscriptionResult extends AiUsageReservationResult {
  transcript?: string
  durationSeconds?: number
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
  generatedDocumentsThisMonth?: number
  generatedImagesThisMonth?: number
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
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para consultar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para consultar uso.')
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
      : 'Não foi possível consultar o saldo agora.'
    throw new Error(message)
  }

  if (!result || !('wallet' in result)) {
    throw new Error('Resposta inválida do servidor.')
  }

  return result
}

export async function reserveAiUsage(input: AiUsageReservationInput): Promise<AiUsageReservationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')

  if (!apiBaseUrl) {
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para continuar.')
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
      : 'Não foi possível registrar o uso agora.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
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
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para continuar.')
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
      : 'Não foi possível gerar o documento agora.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
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
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para continuar.')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 300000)
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/api/ai/generate-portfolio-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A criação da imagem demorou mais do que o esperado. Tente novamente.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }

  const result = await response.json().catch(() => null) as Partial<AiImageGenerationResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Não foi possível gerar a imagem agora.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
  }

  if (result.allowed && !result.imageDataUrl) {
    throw new Error('Não foi possível obter a imagem do portfólio. Tente novamente.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    imageDataUrl: typeof result.imageDataUrl === 'string' ? result.imageDataUrl : undefined,
    prompt: typeof result.prompt === 'string' ? result.prompt : undefined,
    quality: result.quality === 'high' ? 'high' : 'medium',
    reportId: typeof result.reportId === 'string' ? result.reportId : undefined,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : undefined,
    provider: typeof result.provider === 'string' ? result.provider : undefined,
    model: typeof result.model === 'string' ? result.model : undefined,
  }
}

export async function generateImage(input: GeneratedImageInput): Promise<AiImageGenerationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para continuar.')
  }

  const quality = input.quality ?? 'standard'

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 120000)
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/api/ai/generate-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quality,
        classId: input.classId ?? null,
        studentId: input.studentId ?? null,
        requestSummary: {
          description: input.description,
          imageQuality: quality,
        },
      }),
      signal: controller.signal,
    })
  } catch (requestError) {
    if (requestError instanceof DOMException && requestError.name === 'AbortError') {
      throw new Error('A geração da imagem demorou mais do que o esperado. Tente novamente.')
    }
    throw requestError
  } finally {
    window.clearTimeout(timeout)
  }

  const result = await response.json().catch(() => null) as Partial<AiImageGenerationResult> | { error?: string } | null
  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Não foi possível criar a imagem. Tente novamente.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    imageDataUrl: typeof result.imageDataUrl === 'string' ? result.imageDataUrl : undefined,
    prompt: typeof result.prompt === 'string' ? result.prompt : undefined,
    quality: result.quality === 'high'
      ? 'high'
      : result.quality === 'medium'
        ? 'medium'
        : 'standard',
    reportId: typeof result.reportId === 'string' ? result.reportId : undefined,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : undefined,
  }
}

export async function generateAiChatReply(input: AiChatGenerationInput): Promise<AiChatGenerationResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para usar o chat.')
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => null) as Partial<AiChatGenerationResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Nao foi possivel responder no chat agora.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    response: typeof result.response === 'string' ? result.response : undefined,
    provider: typeof result.provider === 'string' ? result.provider : undefined,
    model: typeof result.model === 'string' ? result.model : undefined,
  }
}

export async function transcribeAnnotationAudio(input: {
  audio: Blob
  durationSeconds: number
  classId?: string | null
  studentId?: string | null
  requestSummary?: Record<string, unknown>
}): Promise<AiAudioTranscriptionResult> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Serviço de geração não configurado. Informe VITE_APPROF_ADMIN_API_URL no app da professora.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para registrar uso.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Entre novamente para transcrever o audio.')
  }

  const form = new FormData()
  form.append('audio', input.audio, getAudioFilename(input.audio.type))
  form.append('durationSeconds', String(input.durationSeconds))
  if (input.classId) form.append('classId', input.classId)
  if (input.studentId) form.append('studentId', input.studentId)
  form.append('requestSummary', JSON.stringify(input.requestSummary ?? {}))

  const response = await fetch(`${apiBaseUrl}/api/ai/transcribe-audio`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  const result = await response.json().catch(() => null) as Partial<AiAudioTranscriptionResult> | { error?: string } | null

  if (!response.ok && response.status !== 402) {
    const message = result && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Não foi possível transcrever o áudio.'
    throw new Error(message)
  }

  if (!result || !('allowed' in result)) {
    throw new Error('Resposta inválida do servidor.')
  }

  return {
    allowed: Boolean(result.allowed),
    message: typeof result.message === 'string' ? result.message : '',
    chargeSource: result.chargeSource,
    wallet: result.wallet,
    entitlement: result.entitlement,
    transcript: typeof result.transcript === 'string' ? result.transcript : undefined,
    durationSeconds: typeof result.durationSeconds === 'number' ? result.durationSeconds : undefined,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : undefined,
    provider: typeof result.provider === 'string' ? result.provider : undefined,
    model: typeof result.model === 'string' ? result.model : undefined,
  }
}

function getAudioFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'anotacao.mp4'
  if (mimeType.includes('mpeg')) return 'anotacao.mp3'
  if (mimeType.includes('wav')) return 'anotacao.wav'
  if (mimeType.includes('ogg')) return 'anotacao.ogg'
  return 'anotacao.webm'
}

export function formatAiUsageMessage(result: AiUsageReservationResult) {
  if (!result.allowed) return result.message || 'Esta geracao precisa de pacote extra.'

  if (result.chargeSource === 'semester_entitlement' && result.entitlement) {
    return `Cota semestral usada: ${result.entitlement.usedQuantity}/${result.entitlement.includedQuantity}.`
  }

  if (result.wallet) {
    return `GizTokens restantes: ${result.wallet.giztokensRemaining}.`
  }

  return result.message || 'Uso registrado.'
}
