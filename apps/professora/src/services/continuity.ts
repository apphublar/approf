import { getSupabaseClient } from './supabase/client'
import type { ChildSearchPreview } from '@/types'

export type ContinuityRequestType = 'link' | 'transfer_teacher' | 'transfer_class'

export interface ExternalChildPreview extends ChildSearchPreview {
  ownerId: string
  isExternal: boolean
}

async function callContinuityApi<T>(path: string, init: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  const baseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!baseUrl) throw new Error('Backend não configurado. Informe VITE_APPROF_ADMIN_API_URL.')

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new Error(payload?.error || 'Não foi possível concluir a operação de continuidade.')
  }
  return payload as T
}

export async function searchExternalChildPreviews(input: {
  childCode?: string
  name?: string
  birthDate?: string
}): Promise<ExternalChildPreview[]> {
  const payload = await callContinuityApi<{ previews?: ExternalChildPreview[] }>('/api/continuity/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return Array.isArray(payload.previews) ? payload.previews : []
}

export async function submitContinuityRequest(input: {
  requestType: ContinuityRequestType
  studentId: string
  targetClassId?: string | null
  targetTeacherCode?: string | null
  reason?: string | null
}) {
  return callContinuityApi<{ requestId: string; immediate: boolean }>('/api/continuity/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
