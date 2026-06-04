import { getSupabaseClient } from './supabase/client'

export interface CoordinatorShareResult {
  shareUrl: string
  share: {
    id: string
    coordinator_name: string
    coordinator_email: string
    access_status: 'pending' | 'verified' | 'revoked' | 'review_finalized'
  }
}

export interface CoordinatorShareInfo {
  id: string
  coordinator_name: string
  coordinator_email: string
  share_token: string
  access_status: 'pending' | 'verified' | 'revoked' | 'review_finalized'
  verified_at: string | null
  last_access_at: string | null
  updated_at: string
}

export interface CoordinatorShareStatus {
  shares: CoordinatorShareInfo[]
  reportSummary: {
    total: number
    approved: number
    changesRequested: number
  }
}

export interface ReportReviewEvent {
  id: string
  report_id: string
  student_id: string | null
  class_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: string
  notes: string | null
  previous_status: string | null
  next_status: string | null
  created_at: string
}

export async function getCoordinatorShareStatus(classId: string): Promise<CoordinatorShareStatus> {
  return callCoordinatorApi<CoordinatorShareStatus>(`/api/coordinator/share?classId=${encodeURIComponent(classId)}`, {
    method: 'GET',
  })
}

export async function shareClassWithCoordinator(input: {
  classId: string
  coordinatorName: string
  coordinatorEmail: string
}) {
  return callCoordinatorApi<CoordinatorShareResult>('/api/coordinator/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function listReportReviewEvents(filters: { studentId?: string; classId?: string }) {
  const params = new URLSearchParams()
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.classId) params.set('classId', filters.classId)
  const query = params.toString()
  return callCoordinatorApi<{ events: ReportReviewEvent[] }>(`/api/coordinator/review-events${query ? `?${query}` : ''}`, {
    method: 'GET',
  }).then((response) => response.events)
}

async function callCoordinatorApi<T>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) throw new Error('Backend da coordenadora não configurado.')

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as { error?: string } | Record<string, unknown> | null
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Não foi possível concluir a solicitação.'
    throw new Error(message)
  }
  return payload as T
}
