import { revalidatePath } from 'next/cache'
import type { ReactNode } from 'react'
import { ExternalLink, Eye, FileText, Flag, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { requireAdminSession } from '../lib/admin-auth'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type MaterialStatus = 'draft' | 'published' | 'archived' | 'review_required' | 'blocked' | 'em_analise'

type MaterialRecord = {
  id: string
  title: string
  description: string | null
  type: string | null
  age_range: string | null
  pedagogical_objective: string | null
  file_name: string | null
  file_path: string | null
  file_type: string | null
  file_size_bytes: number | null
  status: MaterialStatus
  ai_analysis_status: string | null
  ai_review: Record<string, unknown> | null
  detected_category: string | null
  content_preview: string | null
  author_name: string | null
  author_avatar: string | null
  downloads_count: number | null
  views_count: number | null
  ratings_count: number | null
  average_rating: number | null
  reports_count: number | null
  auto_hidden_at: string | null
  published_at: string | null
  created_at: string
  openUrl?: string | null
}

type ReportRecord = {
  id: string
  material_id: string
  reporter_id: string | null
  reason: string
  details: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  created_at: string
}

const statusOptions: Array<{ value: MaterialStatus; label: string }> = [
  { value: 'published', label: 'Aprovado' },
  { value: 'em_analise', label: 'Em analise' },
  { value: 'review_required', label: 'Revisao necessaria' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'archived', label: 'Arquivado' },
  { value: 'draft', label: 'Rascunho' },
]

export default async function MaterialsPage() {
  const supabase = createSupabaseServiceClient()
  const [{ data: materialsData, error }, { data: categoriesData }, { data: reportsData }] = await Promise.all([
    supabase
      .from('materials')
      .select('id, title, description, type, age_range, pedagogical_objective, file_name, file_path, file_type, file_size_bytes, status, ai_analysis_status, ai_review, detected_category, content_preview, author_name, author_avatar, downloads_count, views_count, ratings_count, average_rating, reports_count, auto_hidden_at, published_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('material_categories')
      .select('id, name, slug, is_active, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('material_reports')
      .select('id, material_id, reporter_id, reason, details, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(80),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const rawMaterials = (materialsData ?? []) as MaterialRecord[]
  const materials = await Promise.all(rawMaterials.map(async (material) => {
    if (!material.file_path) return { ...material, openUrl: null }
    const signed = await supabase.storage
      .from('material-apoio')
      .createSignedUrl(material.file_path, 60 * 30, { download: material.file_name || material.title })
    if (signed.data?.signedUrl) return { ...material, openUrl: signed.data.signedUrl }
    const legacySigned = await supabase.storage
      .from('material-files')
      .createSignedUrl(material.file_path, 60 * 30, { download: material.file_name || material.title })
    return { ...material, openUrl: legacySigned.data?.signedUrl ?? null }
  }))
  const reports = (reportsData ?? []) as ReportRecord[]
  const metrics = {
    published: materials.filter((item) => item.status === 'published').length,
    review: materials.filter((item) => item.status === 'review_required' || item.status === 'em_analise').length,
    blocked: materials.filter((item) => item.status === 'blocked').length,
    reports: reports.length,
  }

  return (
    <>
      <PageHeader
        eyebrow="Material de apoio"
        title="Biblioteca e moderacao"
        description="Auditoria real dos materiais enviados pelas professoras, com IA, denuncias, status de publicacao e trilha administrativa."
        action={
          <form action={refreshMaterialModeration}>
            <button className="quiet-button" type="submit">
              <ShieldCheck size={15} />
              Atualizar moderacao
            </button>
          </form>
        }
      />

      <section className="metrics-grid">
        <Metric icon={<FileText size={18} />} label="Aprovados" value={metrics.published} />
        <Metric icon={<Eye size={18} />} label="Em revisao" value={metrics.review} />
        <Metric icon={<ShieldCheck size={18} />} label="Bloqueados" value={metrics.blocked} />
        <Metric icon={<Flag size={18} />} label="Denuncias abertas" value={metrics.reports} />
      </section>

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Moderacao</p>
              <h2>Materiais cadastrados</h2>
            </div>
          </div>

          <div className="table">
            <div className="table-row table-head admin-materials-grid">
              <span>Material</span>
              <span>Autora</span>
              <span>Status</span>
              <span>Indicadores</span>
              <span>Acao</span>
            </div>
            {materials.map((material) => (
              <div className="table-row admin-materials-grid" key={material.id}>
                <span>
                  <strong>{material.title}</strong>
                  <small>{material.description || material.file_name || 'Sem descricao cadastrada'}</small>
                  <small>
                    {material.type || inferType(material.file_type, material.file_name)} - {material.age_range || 'faixa etaria nao informada'} - {material.pedagogical_objective || material.detected_category || 'objetivo nao informado'}
                  </small>
                  {material.content_preview && <small>Preview: {material.content_preview.slice(0, 180)}</small>}
                </span>
                <span>
                  <strong>{material.author_name || 'Professora'}</strong>
                  <small>{formatDate(material.created_at)}</small>
                  {material.auto_hidden_at && <small>Ocultado automaticamente em {formatDate(material.auto_hidden_at)}</small>}
                </span>
                <span>
                  <StatusBadge status={material.status} />
                  <small>IA: {material.ai_analysis_status || 'nao informada'}</small>
                  {material.detected_category && <small>{material.detected_category}</small>}
                </span>
                <span>
                  <small>{material.downloads_count ?? 0} downloads</small>
                  <small>{material.views_count ?? 0} visualizacoes</small>
                  <small>{Number(material.average_rating ?? 0).toFixed(1)} estrelas ({material.ratings_count ?? 0})</small>
                  <small>{material.reports_count ?? 0} denuncias</small>
                </span>
                <form action={updateMaterialStatus} className="inline-form">
                  <input type="hidden" name="materialId" value={material.id} />
                  <input name="title" defaultValue={material.title} placeholder="Titulo" />
                  <textarea name="description" defaultValue={material.description ?? ''} placeholder="Descricao" />
                  <input name="ageRange" defaultValue={material.age_range ?? ''} placeholder="Faixa etaria" />
                  <input name="pedagogicalObjective" defaultValue={material.pedagogical_objective ?? ''} placeholder="Objetivo pedagogico" />
                  <textarea name="contentPreview" defaultValue={material.content_preview ?? ''} placeholder="Texto/preview editavel" />
                  <select name="status" defaultValue={material.status}>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <textarea name="notes" placeholder="Nota de moderacao opcional" />
                  <div className="action-row">
                    {material.openUrl && (
                      <a className="quiet-button secondary-action" href={material.openUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Abrir arquivo
                      </a>
                    )}
                    <button className="quiet-button" name="quickStatus" value="published" type="submit">Aprovar</button>
                    <button className="quiet-button secondary-action" type="submit">Salvar</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Categorias</p>
              <h2>Organizacao</h2>
            </div>
          </div>
          <div className="stack-list">
            {(categoriesData ?? []).map((category) => (
              <div className="stack-item" key={category.id}>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.slug}</small>
                </span>
                <StatusBadge status={category.is_active ? 'published' : 'archived'} />
              </div>
            ))}
            {(categoriesData ?? []).length === 0 && (
              <p className="text-muted-panel">Nenhuma categoria cadastrada em material_categories.</p>
            )}
          </div>
        </article>
      </section>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Denuncias</p>
            <h2>Fila de revisao</h2>
          </div>
          <span className="status-pill">
            <Flag size={16} />
            {reports.length} abertas
          </span>
        </div>

        <div className="table">
          <div className="table-row table-head reports-grid">
            <span>Material</span>
            <span>Motivo</span>
            <span>Detalhes</span>
            <span>Acao</span>
          </div>
          {reports.map((report) => {
            const material = materials.find((item) => item.id === report.material_id)
            return (
              <div className="table-row reports-grid" key={report.id}>
                <span>
                  <strong>{material?.title || report.material_id}</strong>
                  <small>{formatDate(report.created_at)}</small>
                </span>
                <span>{formatReportReason(report.reason)}</span>
                <span>{report.details || 'Sem detalhes adicionais'}</span>
                <form action={reviewReport} className="action-row">
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="materialId" value={report.material_id} />
                  <button className="quiet-button secondary-action" name="decision" value="dismissed" type="submit">Dispensar</button>
                  <button className="quiet-button" name="decision" value="reviewed" type="submit">Marcar revisada</button>
                </form>
              </div>
            )
          })}
          {reports.length === 0 && (
            <div className="table-row reports-grid">
              <strong>Nenhuma denuncia aberta</strong>
              <span>Fila limpa</span>
              <span>Materiais permanecem visiveis conforme status atual.</span>
              <span />
            </div>
          )}
        </div>
      </article>
    </>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="metric-card">
      {icon}
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  )
}

async function updateMaterialStatus(formData: FormData) {
  'use server'
  const admin = await requireAdminSession()
  const materialId = String(formData.get('materialId') ?? '').trim()
  const quickStatus = String(formData.get('quickStatus') ?? '').trim()
  const status = (quickStatus || String(formData.get('status') ?? '').trim()) as MaterialStatus
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const ageRange = String(formData.get('ageRange') ?? '').trim()
  const pedagogicalObjective = String(formData.get('pedagogicalObjective') ?? '').trim()
  const contentPreview = String(formData.get('contentPreview') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  if (!materialId || !statusOptions.some((option) => option.value === status)) return

  const supabase = createSupabaseServiceClient()
  const payload: Record<string, unknown> = {
    status,
    ...(title ? { title } : {}),
    description: description || null,
    age_range: ageRange || null,
    pedagogical_objective: pedagogicalObjective || null,
    content_preview: contentPreview || null,
    ai_analysis_status: status === 'published' ? 'approved_by_admin' : status,
    reviewed_at: new Date().toISOString(),
  }
  if (status === 'published') payload.published_at = new Date().toISOString()
  if (status === 'blocked' || status === 'review_required') payload.auto_hidden_at = new Date().toISOString()

  const { error } = await supabase.from('materials').update(payload).eq('id', materialId)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'material_admin_status_updated',
    target_table: 'materials',
    target_id: materialId,
    metadata: { status, notes },
  })
  revalidatePath('/materiais')
}

async function reviewReport(formData: FormData) {
  'use server'
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
  revalidatePath('/materiais')
}

async function refreshMaterialModeration() {
  'use server'
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
}

function inferType(fileType: string | null, fileName: string | null) {
  if (fileType?.startsWith('image/')) return 'image'
  if (fileName && /\.(jpg|jpeg|png|webp)$/i.test(fileName)) return 'image'
  return 'document'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatReportReason(reason: string) {
  const key = reason.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const labels: Record<string, string> = {
    dados_pessoais: 'Dados pessoais',
    imagem_crianca: 'Imagem de crianca',
    conteudo_inadequado: 'Conteudo inadequado',
    spam: 'Propaganda ou spam',
    outro: 'Outro motivo',
  }
  return labels[key] ?? reason
}
