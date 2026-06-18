import type { CreatorPayload } from './types'
import { getSupabaseClient } from '@/services/supabase/client'

async function authHeaders() {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) throw new Error('Serviço de IA não configurado.')

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  return { apiBaseUrl, token }
}

export interface CreatorGenerationResult {
  allowed: boolean
  message?: string
  generatedText?: string
  reportId?: string
  imageDataUrl?: string
  actualCostCents?: number
  giztokensCharged?: number
  wallet?: { giztokensRemaining: number }
}

export async function generateCreatorDocument(input: {
  creator: CreatorPayload
  classId?: string | null
  studentId?: string | null
}): Promise<CreatorGenerationResult> {
  const { apiBaseUrl, token } = await authHeaders()

  const response = await fetch(`${apiBaseUrl}/api/ai/generate-creator`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promptVersion: 'creator-v2',
      classId: input.classId ?? null,
      studentId: input.studentId ?? null,
      creator: input.creator,
    }),
  })

  const result = await response.json().catch(() => null) as CreatorGenerationResult & { error?: string }
  if (!response.ok && response.status !== 402) {
    throw new Error(result?.error || 'Não foi possível gerar o documento.')
  }
  if (!result || typeof result.allowed !== 'boolean') {
    throw new Error('Resposta inválida do servidor.')
  }
  return result
}

export async function improveCreatorPrompt(input: {
  mode: CreatorPayload['mode']
  documentType?: CreatorPayload['documentType']
  sourceMode?: CreatorPayload['sourceMode']
  outputFormat?: CreatorPayload['outputFormat']
  teacherPrompt: string
  ageGroupOrContext?: string
  studentContext?: CreatorPayload['studentContext']
  classContext?: CreatorPayload['classContext']
}) {
  const { apiBaseUrl, token } = await authHeaders()
  const response = await fetch(`${apiBaseUrl}/api/ai/improve-prompt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => null) as {
    allowed?: boolean
    improvedPrompt?: string
    error?: string
    wallet?: { giztokensRemaining: number }
  }
  if (!response.ok && response.status !== 402) {
    throw new Error(result?.error || 'Não foi possível aprimorar o prompt.')
  }
  if (!result?.allowed || !result.improvedPrompt) {
    throw new Error(result?.error || 'Não foi possível aprimorar o prompt.')
  }
  return result
}

export async function improveAnnotationText(input: {
  noteText: string
  label?: string
  studentName?: string
  className?: string
  classId?: string | null
  studentId?: string | null
}) {
  const { apiBaseUrl, token } = await authHeaders()
  const response = await fetch(`${apiBaseUrl}/api/ai/improve-note`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => null) as {
    allowed?: boolean
    improvedText?: string
    error?: string
    wallet?: { giztokensRemaining: number }
  }
  if (!response.ok && response.status !== 402) {
    throw new Error(result?.error || 'Não foi possível aprimorar a anotação.')
  }
  if (!result?.allowed || !result.improvedText) {
    throw new Error(result?.error || 'Não foi possível aprimorar a anotação.')
  }
  return result
}
