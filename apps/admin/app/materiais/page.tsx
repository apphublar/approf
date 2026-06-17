import { FileText, Flag } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { quickMaterialStatusAction, refreshMaterialModerationAction, reviewReportAction } from './actions'

export const dynamic = 'force-dynamic'

type MaterialRecord = {
  id: string
  title: string
  status: string
  detected_category: string | null
  author_name: string | null
  reports_count: number | null
  openUrl?: string | null
}

type ReportRecord = {
  id: string
  material_id: string
  reason: string
  details: string | null
}

const statusLabel: Record<string, string> = {
  published: 'Publicado',
  em_analise: 'Em análise',
  review_required: 'Em análise',
  blocked: 'Bloqueado',
  archived: 'Arquivado',
  draft: 'Rascunho',
}

const statusChip: Record<string, string> = {
  published: 'approved',
  em_analise: 'overdue',
  review_required: 'overdue',
  blocked: 'blocked',
  draft: 'free',
  archived: 'free',
}

export default async function MaterialsPage() {
  const supabase = createSupabaseServiceClient()
  const [{ data: materialsData, error }, { data: reportsData }] = await Promise.all([
    supabase
      .from('materials')
      .select('id, title, status, detected_category, author_name, file_path, file_name, reports_count')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('material_reports')
      .select('id, material_id, reason, details, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(80),
  ])

  if (error) throw new Error(error.message)

  const rawMaterials = (materialsData ?? []) as Array<MaterialRecord & { file_path: string | null; file_name: string | null }>
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
  const reportedIds = new Set(reports.map((report) => report.material_id))

  const metrics = {
    pub: materials.filter((item) => item.status === 'published').length,
    analise: materials.filter((item) => ['review_required', 'em_analise'].includes(item.status)).length,
    bloq: materials.filter((item) => item.status === 'blocked').length,
    denuncias: reports.length,
  }

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Conteúdo"
        title="Materiais de apoio"
        description="Biblioteca comunitária. Denúncias entram na mesma fila — modere por aqui."
        action={
          <form action={refreshMaterialModerationAction}>
            <button type="submit" className="btn-ghost-v2">Sincronizar denúncias</button>
          </form>
        }
      />

      <section className="metric-grid-v2">
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Publicados</span><FileText size={18} /></div><strong style={{ color: '#1c6b46' }}>{metrics.pub}</strong></article>
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Em análise</span></div><strong style={{ color: '#8a6516' }}>{metrics.analise}</strong></article>
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Bloqueados</span></div><strong>{metrics.bloq}</strong></article>
        <article className="metric-card-v2" style={{ borderColor: metrics.denuncias ? '#f3cfca' : undefined }}>
          <div className="metric-card-v2-head"><span style={{ color: metrics.denuncias ? '#b4382f' : undefined }}>Denúncias abertas</span><Flag size={18} /></div>
          <strong style={{ color: '#b4382f' }}>{metrics.denuncias}</strong>
        </article>
      </section>

      <article className="panel-v2">
        <div className="data-table-v2-head" style={{ gridTemplateColumns: '2.6fr 1.4fr 1fr 1.6fr' }}>
          <span>Material</span><span>Autora</span><span>Status</span><span style={{ textAlign: 'right' }}>Moderação</span>
        </div>
        {materials.map((material) => {
          const chip = statusChip[material.status] ?? 'free'
          const reported = reportedIds.has(material.id) || (material.reports_count ?? 0) > 0
          return (
            <div key={material.id} className="data-table-v2-row" style={{ gridTemplateColumns: '2.6fr 1.4fr 1fr 1.6fr' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <FileText size={18} color="#1c6b46" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {material.title}
                    {reported ? <span className="status-chip status-chip-blocked" style={{ fontSize: 10 }}>DENUNCIA</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a948c' }}>{material.detected_category || 'Sem categoria'}</div>
                </div>
              </div>
              <span style={{ fontSize: 13 }}>{material.author_name || 'Professora'}</span>
              <span className={`status-chip status-chip-${chip}`}>{statusLabel[material.status] ?? material.status}</span>
              <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {material.openUrl ? (
                  <a href={material.openUrl} target="_blank" rel="noreferrer" className="btn-ghost-v2 btn-sm-v2">Abrir</a>
                ) : null}
                <form action={quickMaterialStatusAction}>
                  <input type="hidden" name="materialId" value={material.id} />
                  <input type="hidden" name="title" value={material.title} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="btn-secondary-v2 btn-sm-v2">Publicar</button>
                </form>
                <form action={quickMaterialStatusAction}>
                  <input type="hidden" name="materialId" value={material.id} />
                  <input type="hidden" name="title" value={material.title} />
                  <input type="hidden" name="status" value="blocked" />
                  <button type="submit" className="btn-danger-v2 btn-sm-v2">Bloquear</button>
                </form>
              </div>
            </div>
          )
        })}
      </article>

      {reports.length > 0 ? (
        <article className="panel-v2" style={{ marginTop: 20 }}>
          <div className="panel-v2-header"><h2>Fila de denúncias</h2></div>
          {reports.map((report) => {
            const material = materials.find((item) => item.id === report.material_id)
            return (
              <div key={report.id} className="data-table-v2-row" style={{ gridTemplateColumns: '2fr 1fr 1.5fr auto auto', display: 'grid', gap: 12, padding: '14px 20px' }}>
                <strong>{material?.title ?? report.material_id}</strong>
                <span style={{ fontSize: 13 }}>{formatReportReason(report.reason)}</span>
                <span style={{ fontSize: 13, color: '#5f6b63' }}>{report.details || 'Sem detalhes'}</span>
                <form action={reviewReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="materialId" value={report.material_id} />
                  <input type="hidden" name="decision" value="dismissed" />
                  <button type="submit" className="btn-ghost-v2 btn-sm-v2">Dispensar</button>
                </form>
                <form action={reviewReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="materialId" value={report.material_id} />
                  <input type="hidden" name="decision" value="reviewed" />
                  <button type="submit" className="btn-primary-v2 btn-sm-v2">Revisada</button>
                </form>
              </div>
            )
          })}
        </article>
      ) : null}
    </div>
  )
}

function formatReportReason(reason: string) {
  const labels: Record<string, string> = {
    dados_pessoais: 'Dados pessoais',
    imagem_crianca: 'Imagem de crianca',
    conteudo_inadequado: 'Conteúdo inadequado',
    spam: 'Spam',
    outro: 'Outro',
  }
  return labels[reason] ?? reason
}
