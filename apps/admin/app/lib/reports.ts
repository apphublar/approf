import { createSupabaseServiceClient } from './supabase-server'

export type ReportStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'archived'

const REPORT_STATUSES = new Set<ReportStatus>(['draft', 'generating', 'ready', 'failed', 'archived'])

export interface ReportListFilters {
  status?: ReportStatus
  reportType?: string
  studentId?: string
  classId?: string
  limit?: number
}

export async function listOwnerReports(ownerId: string, filters: ReportListFilters) {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('reports')
    .select(
      'id, owner_id, student_id, class_id, status, report_type, prompt_version, is_final_version, created_at, updated_at',
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.reportType) query = query.eq('report_type', filters.reportType)
  if (filters.studentId) query = query.eq('student_id', filters.studentId)
  if (filters.classId) query = query.eq('class_id', filters.classId)
  if (filters.limit && Number.isFinite(filters.limit)) query = query.limit(Math.max(1, Math.min(filters.limit, 200)))

  const { data, error } = await query
  if (error) throw toError(error, 'Nao foi possivel listar documentos.')
  return data ?? []
}

export async function getOwnerReportById(ownerId: string, reportId: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reports')
    .select('id, owner_id, student_id, class_id, status, report_type, prompt_version, body, is_final_version, created_at, updated_at')
    .eq('id', reportId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) throw toError(error, 'Nao foi possivel carregar o documento.')
  return data
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
    .select('id, owner_id, student_id, class_id, status, report_type, prompt_version, body, is_final_version, created_at, updated_at')
    .single()

  if (error) throw toError(error, 'Nao foi possivel salvar documento.')

  if (typeof input.isFinalVersion === 'boolean') {
    return setOwnerReportFinalVersion(input.ownerId, input.reportId, input.isFinalVersion)
  }

  return data
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

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
