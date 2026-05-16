import { createSupabaseServiceClient } from './supabase-server'
import { createHmac, timingSafeEqual } from 'crypto'

export type ReportStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'archived'

const REPORT_STATUSES = new Set<ReportStatus>(['draft', 'generating', 'ready', 'failed', 'archived'])
const REPORT_SELECT_WITH_ARTIFACTS =
  'id, owner_id, student_id, class_id, status, report_type, prompt_version, body, ai_artifacts, is_final_version, created_at, updated_at'
const REPORT_SELECT_BASE =
  'id, owner_id, student_id, class_id, status, report_type, prompt_version, body, is_final_version, created_at, updated_at'

export interface ReportListFilters {
  status?: ReportStatus
  reportType?: string
  studentId?: string
  classId?: string
  limit?: number
}

export async function listOwnerReports(ownerId: string, filters: ReportListFilters) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await applyListFilters(
    supabase.from('reports').select(REPORT_SELECT_WITH_ARTIFACTS),
    ownerId,
    filters,
  )

  if (error && isMissingAiArtifactsColumn(error)) {
    const fallback = await applyListFilters(
      supabase.from('reports').select(REPORT_SELECT_BASE),
      ownerId,
      filters,
    )
    if (fallback.error) throw toError(fallback.error, 'Nao foi possivel listar documentos.')
    return (fallback.data ?? []).map(withEmptyArtifacts)
  }

  if (error) throw toError(error, 'Nao foi possivel listar documentos.')
  return data ?? []
}

export async function getOwnerReportById(ownerId: string, reportId: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reports')
    .select(REPORT_SELECT_WITH_ARTIFACTS)
    .eq('id', reportId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error && isMissingAiArtifactsColumn(error)) {
    const fallback = await supabase
      .from('reports')
      .select(REPORT_SELECT_BASE)
      .eq('id', reportId)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (fallback.error) throw toError(fallback.error, 'Nao foi possivel carregar o documento.')
    return fallback.data ? withEmptyArtifacts(fallback.data) : null
  }

  if (error) throw toError(error, 'Nao foi possivel carregar o documento.')
  return data
}

export async function getPublicReportByShareToken(reportId: string, token: string) {
  if (!isValidShareToken(reportId, token)) return null

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reports')
    .select(REPORT_SELECT_WITH_ARTIFACTS)
    .eq('id', reportId)
    .neq('status', 'archived')
    .maybeSingle()

  if (error && isMissingAiArtifactsColumn(error)) {
    const fallback = await supabase
      .from('reports')
      .select(REPORT_SELECT_BASE)
      .eq('id', reportId)
      .neq('status', 'archived')
      .maybeSingle()
    if (fallback.error) throw toError(fallback.error, 'Nao foi possivel carregar o documento publico.')
    return fallback.data ? withEmptyArtifacts(fallback.data) : null
  }

  if (error) throw toError(error, 'Nao foi possivel carregar o documento publico.')
  return data
}

export function createReportShareToken(reportId: string) {
  return signReportId(reportId)
}

export async function updateOwnerReport(input: {
  ownerId: string
  reportId: string
  body?: string
  status?: ReportStatus
  isFinalVersion?: boolean
}) {
  const supabase = createSupabaseServiceClient()
  const current = await getOwnerReportById(input.ownerId, input.reportId)
  if (!current) return null

  const patch: Record<string, unknown> = {}
  if (typeof input.body === 'string') patch.body = input.body
  if (input.status) patch.status = input.status

  if (!Object.keys(patch).length) {
    if (typeof input.isFinalVersion === 'boolean') {
      return setOwnerReportFinalVersion(input.ownerId, input.reportId, input.isFinalVersion)
    }
    return current
  }

  const { data, error } = await supabase
    .from('reports')
    .update(patch)
    .eq('id', input.reportId)
    .eq('owner_id', input.ownerId)
    .select(REPORT_SELECT_WITH_ARTIFACTS)
    .single()

  if (error && isMissingAiArtifactsColumn(error)) {
    const fallback = await supabase
      .from('reports')
      .select(REPORT_SELECT_BASE)
      .eq('id', input.reportId)
      .eq('owner_id', input.ownerId)
      .single()
    if (fallback.error) throw toError(fallback.error, 'Nao foi possivel salvar documento.')
    return withEmptyArtifacts(fallback.data)
  }

  if (error) throw toError(error, 'Nao foi possivel salvar documento.')

  if (typeof input.isFinalVersion === 'boolean') {
    return setOwnerReportFinalVersion(input.ownerId, input.reportId, input.isFinalVersion)
  }

  return data
}

function applyListFilters(
  query: any,
  ownerId: string,
  filters: ReportListFilters,
) {
  let scopedQuery = query
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (filters.status) scopedQuery = scopedQuery.eq('status', filters.status)
  if (filters.reportType) scopedQuery = scopedQuery.eq('report_type', filters.reportType)
  if (filters.studentId) scopedQuery = scopedQuery.eq('student_id', filters.studentId)
  if (filters.classId) scopedQuery = scopedQuery.eq('class_id', filters.classId)
  if (filters.limit && Number.isFinite(filters.limit)) scopedQuery = scopedQuery.limit(Math.max(1, Math.min(filters.limit, 200)))

  return scopedQuery
}

function withEmptyArtifacts<T extends Record<string, unknown>>(report: T) {
  return { ...report, ai_artifacts: null }
}

function isMissingAiArtifactsColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { message?: string; details?: string; hint?: string; code?: string }
  const text = `${record.message ?? ''} ${record.details ?? ''} ${record.hint ?? ''}`
  return text.includes('ai_artifacts')
}

export async function setOwnerReportFinalVersion(ownerId: string, reportId: string, isFinalVersion: boolean) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('set_report_final_version', {
    p_owner_id: ownerId,
    p_report_id: reportId,
    p_is_final: isFinalVersion,
  })

  if (error) throw toError(error, 'Nao foi possivel atualizar versao final.')

  const result = Array.isArray(data) ? data[0] : data
  return result ?? null
}

export function parseReportStatus(value: unknown): ReportStatus | undefined {
  if (typeof value === 'string' && REPORT_STATUSES.has(value as ReportStatus)) {
    return value as ReportStatus
  }
  return undefined
}

function signReportId(reportId: string) {
  return createHmac('sha256', getShareSecret()).update(reportId).digest('base64url')
}

function isValidShareToken(reportId: string, token: string) {
  if (!reportId || !token) return false
  const expected = signReportId(reportId)
  const expectedBuffer = Buffer.from(expected)
  const tokenBuffer = Buffer.from(token)
  if (expectedBuffer.length !== tokenBuffer.length) return false
  return timingSafeEqual(expectedBuffer, tokenBuffer)
}

function getShareSecret() {
  const secret = process.env.REPORT_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (secret?.trim()) return secret.trim()
  // Local development fallback only. Production must define REPORT_SHARE_SECRET or SUPABASE_SERVICE_ROLE_KEY.
  return 'approf-local-report-share-secret'
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
