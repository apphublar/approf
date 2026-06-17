'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '../lib/admin-auth'
import { redirectWithToast } from '../lib/redirect-with-toast'
import { createSupabaseServiceClient } from '../lib/supabase-server'

type MaterialStatus = 'draft' | 'published' | 'archived' | 'review_required' | 'blocked' | 'em_analise'

const statusOptions: Array<{ value: MaterialStatus; label: string }> = [
  { value: 'published', label: 'Aprovado' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'review_required', label: 'Revisao necessaria' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'archived', label: 'Arquivado' },
  { value: 'draft', label: 'Rascunho' },
]

export async function quickMaterialStatusAction(formData: FormData) {
  const admin = await requireAdminSession()
  const materialId = String(formData.get('materialId') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as MaterialStatus
  const title = String(formData.get('title') ?? '').trim()
  if (!materialId || !statusOptions.some((option) => option.value === status)) return

  const supabase = createSupabaseServiceClient()
  const payload: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  }
  if (status === 'published') {
    payload.published_at = new Date().toISOString()
    payload.auto_hidden_at = null
    payload.ai_analysis_status = 'approved'
  } else {
    payload.ai_analysis_status = status
  }
  if (status === 'blocked' || status === 'review_required') payload.auto_hidden_at = new Date().toISOString()

  const { error } = await supabase.from('materials').update(payload).eq('id', materialId)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'material_admin_status_updated',
    target_table: 'materials',
    target_id: materialId,
    metadata: { status, title },
  })

  const label = status === 'published' ? 'publicado' : 'bloqueado'
  redirectWithToast('/materiais', `"${title}" ${label}.`)
}

export async function reviewReportAction(formData: FormData) {
  const admin = await requireAdminSession()
  const reportId = String(formData.get('reportId') ?? '').trim()
  const materialId = String(formData.get('materialId') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  if (!reportId || !materialId || !['reviewed', 'dismissed'].includes(decision)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('material_reports')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: admin.userId })
    .eq('id', reportId)
  if (error) throw new Error(error.message)

  const { data: openReports, error: countError } = await supabase
    .from('material_reports')
    .select('id')
    .eq('material_id', materialId)
    .eq('status', 'open')
  if (countError) throw new Error(countError.message)

  await supabase.from('materials').update({ reports_count: openReports?.length ?? 0 }).eq('id', materialId)
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'material_report_reviewed',
    target_table: 'materials',
    target_id: materialId,
    metadata: { reportId, decision },
  })

  redirectWithToast('/materiais', 'Denúncia atualizada.')
}

export async function refreshMaterialModerationAction() {
  await requireAdminSession()
  const supabase = createSupabaseServiceClient()
  const { data: groupedReports, error } = await supabase
    .from('material_reports')
    .select('material_id')
    .eq('status', 'open')
  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const report of groupedReports ?? []) {
    const materialId = String(report.material_id ?? '')
    if (!materialId) continue
    counts.set(materialId, (counts.get(materialId) ?? 0) + 1)
  }

  await Promise.all(Array.from(counts.entries()).map(([materialId, count]) => {
    const update: Record<string, unknown> = { reports_count: count }
    if (count >= 3) {
      update.status = 'review_required'
      update.ai_analysis_status = 'reported'
      update.auto_hidden_at = new Date().toISOString()
    }
    return supabase.from('materials').update(update).eq('id', materialId)
  }))

  revalidatePath('/materiais')
  redirectWithToast('/materiais', 'Moderação sincronizada.')
}
