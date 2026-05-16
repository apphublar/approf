import type { GeneratedDocument, ReportStatus } from '@/types'
import { getSupabaseClient } from './supabase/client'

interface ListReportsFilters {
  status?: ReportStatus
  reportType?: string
  studentId?: string
  classId?: string
  limit?: number
}

interface UpdateReportInput {
  body?: string
  status?: ReportStatus
  archive?: boolean
  isFinalVersion?: boolean
}

export async function listReports(filters: ListReportsFilters = {}) {
  const response = await callReportsApi<{ reports: GeneratedDocument[] }>(`/api/reports${buildQuery(filters)}`, { method: 'GET' })
  return response.reports as GeneratedDocument[]
}

export async function getReportById(reportId: string) {
  const response = await callReportsApi<{ report: GeneratedDocument }>(`/api/reports/${reportId}`, { method: 'GET' })
  return response.report as GeneratedDocument
}

export async function updateReport(reportId: string, input: UpdateReportInput) {
  const response = await callReportsApi<{ report: GeneratedDocument }>(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return response.report as GeneratedDocument
}

export async function createReportShareLink(reportId: string) {
  const response = await callReportsApi<{ shareUrl: string }>(`/api/reports/${reportId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create-share-link' }),
  })
  return response.shareUrl
}

function buildQuery(filters: ListReportsFilters) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.reportType) params.set('reportType', filters.reportType)
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.classId) params.set('classId', filters.classId)
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit))
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function callReportsApi<T>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de documentos nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase nao configurado para acessar documentos.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

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
      : 'Falha ao carregar documentos.'
    throw new Error(message)
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta invalida ao acessar documentos.')
  }

  return payload as T
}
