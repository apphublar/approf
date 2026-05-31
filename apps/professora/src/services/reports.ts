import type { GeneratedDocument, ReportStatus } from '@/types'
import { getSupabaseClient } from './supabase/client'

interface ListReportsFilters {
  status?: ReportStatus
  reportType?: string
  reportTypes?: string[]
  studentId?: string
  classId?: string
  limit?: number
  offset?: number
  compact?: boolean
}

interface UpdateReportInput {
  body?: string
  status?: ReportStatus
  archive?: boolean
  isFinalVersion?: boolean
}

export async function listReports(filters: ListReportsFilters = {}) {
  const response = await callReportsApi<{ reports: GeneratedDocument[] }>(`/api/reports${buildQuery(filters)}`, { method: 'GET' })
  const reports = response.reports as GeneratedDocument[]
  reports.forEach((report) => setReportCache(report.id, report))
  return reports
}

export async function getReportById(reportId: string) {
  const cached = reportCache.get(reportId)
  if (cached?.hydrated) return cached.report
  const response = await callReportsApi<{ report: GeneratedDocument }>(`/api/reports/${reportId}`, { method: 'GET' })
  const report = response.report as GeneratedDocument
  setReportCache(reportId, report)
  return report
}

export async function updateReport(reportId: string, input: UpdateReportInput) {
  const response = await callReportsApi<{ report: GeneratedDocument }>(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const report = response.report as GeneratedDocument
  setReportCache(reportId, report)
  return report
}

export function getCachedReportById(reportId: string) {
  const cached = reportCache.get(reportId)
  if (!cached?.hydrated) return null
  return cached.report
}

export async function prefetchReportsByIds(reportIds: string[]) {
  const uniqueIds = Array.from(new Set(reportIds.filter(Boolean)))
  if (!uniqueIds.length) return
  await Promise.all(
    uniqueIds.map(async (id) => {
      const cached = reportCache.get(id)
      if (cached?.hydrated) return
      try {
        const response = await callReportsApi<{ report: GeneratedDocument }>(`/api/reports/${id}`, { method: 'GET' })
        setReportCache(id, response.report as GeneratedDocument)
      } catch {
        // Falha de prefetch não deve interromper navegação.
      }
    }),
  )
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
  if (filters.reportTypes?.length) params.set('reportTypes', filters.reportTypes.join(','))
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.classId) params.set('classId', filters.classId)
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit))
  if (typeof filters.offset === 'number') params.set('offset', String(filters.offset))
  if (filters.compact) params.set('compact', '1')
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function callReportsApi<T>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de documentos não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para acessar documentos.')
  }

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
      : 'Falha ao carregar documentos.'
    throw new Error(message)
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida ao acessar documentos.')
  }

  return payload as T
}

const REPORT_CACHE_LIMIT = 120
const reportCache = new Map<string, { report: GeneratedDocument; hydrated: boolean }>()

function setReportCache(id: string, report: GeneratedDocument) {
  const hydrated = isHydratedReport(report)
  const previous = reportCache.get(id)

  if (!hydrated && previous?.hydrated) {
    return
  }

  reportCache.set(id, { report, hydrated })
  if (reportCache.size <= REPORT_CACHE_LIMIT) return
  const oldestKey = reportCache.keys().next().value as string | undefined
  if (!oldestKey) return
  reportCache.delete(oldestKey)
}

function isHydratedReport(report: GeneratedDocument) {
  const hasBody = typeof report.body === 'string' && report.body.trim().length > 0
  const hasArtifacts = Boolean(report.ai_artifacts && typeof report.ai_artifacts === 'object')
  return hasBody || hasArtifacts
}
