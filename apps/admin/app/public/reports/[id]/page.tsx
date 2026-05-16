import { getPublicReportByShareToken } from '@/app/lib/reports'
import { PublicReportActions } from './PublicReportActions'

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token = '' } = await searchParams
  const report = await getPublicReportByShareToken(id, token)

  if (!report) {
    return (
      <PublicShell>
        <div className="public-card">
          <h1>Documento indisponível</h1>
          <p>O link pode estar incorreto, expirado ou o documento pode ter sido arquivado pela professora.</p>
        </div>
      </PublicShell>
    )
  }

  const title = formatReportType(report.report_type)
  const isImage = report.report_type === 'portfolio_image' || report.ai_artifacts?.kind === 'portfolio_image'
  const imageDataUrl = typeof report.ai_artifacts?.imageDataUrl === 'string' ? report.ai_artifacts.imageDataUrl : undefined
  const html = isImage ? '' : toDocumentHtml(report.body ?? '')

  return (
    <PublicShell>
      <article className="public-card public-document">
        <div className="public-brand">
          <span>Approf</span>
          <small>Documento gerado com apoio pedagógico de IA</small>
        </div>

        <h1>{title}</h1>
        <p className="public-meta">
          Gerado em {formatDate(report.created_at)} · Educação Infantil · BNCC
        </p>

        {isImage ? (
          imageDataUrl ? (
            <img src={imageDataUrl} alt="Imagem pedagógica gerada pelo Approf" className="public-image" />
          ) : (
            <p>Imagem não disponível neste link.</p>
          )
        ) : (
          <div className="public-body" dangerouslySetInnerHTML={{ __html: html }} />
        )}

        <PublicReportActions title={title} html={html} imageDataUrl={imageDataUrl} />

        <footer>
          <strong>Approf</strong> ajuda professoras da Educação Infantil a transformar registros pedagógicos em documentos claros, seguros e alinhados à BNCC.
        </footer>
      </article>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .admin-shell { display: block; min-height: 100vh; background: #FDFAF6; }
        .admin-shell .sidebar { display: none !important; }
        .admin-shell .workspace { max-width: none; padding: 0; margin: 0; }
        .public-page { min-height: 100vh; background: #FDFAF6; padding: 28px 16px; }
        .public-card { max-width: 840px; margin: 0 auto; background: #fff; border: 1px solid #D4EBC8; border-radius: 24px; box-shadow: 0 16px 48px rgba(27,67,50,.10); padding: 32px; color: #1A1A1A; }
        .public-brand { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #E8F3DF; padding-bottom: 16px; margin-bottom: 28px; color: #4F8341; }
        .public-brand span { font-size: 24px; font-weight: 800; font-family: Georgia, serif; color: #1B4332; }
        .public-brand small { text-align: right; color: #6f766f; }
        .public-document h1 { text-align: center; text-transform: uppercase; font-size: 20px; margin: 0 0 10px; color: #1B4332; }
        .public-meta { text-align: center; color: #767676; font-size: 13px; margin-bottom: 28px; }
        .public-body { font-family: Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #222; }
        .public-body p { margin: 0 0 14px; text-align: justify; }
        .public-body h2 { color: #1B4332; font-size: 16px; text-transform: uppercase; margin: 22px 0 10px; }
        .public-image { width: 100%; max-height: 900px; object-fit: contain; border-radius: 18px; border: 1px solid #E8F3DF; background: #FDFAF6; }
        .public-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
        .public-actions button { border: 1px solid #4F8341; background: #4F8341; color: #fff; border-radius: 999px; padding: 11px 16px; font-weight: 700; cursor: pointer; }
        .public-actions button:nth-child(n+2) { background: #F0FAF4; color: #1B4332; }
        footer { margin-top: 28px; border-top: 1px solid #E8F3DF; padding-top: 16px; color: #6f766f; font-size: 13px; line-height: 1.5; }
        @media print {
          .sidebar, .public-brand, .public-actions, footer { display: none !important; }
          .public-page { padding: 0; background: #fff; }
          .public-card { box-shadow: none; border: 0; padding: 0; max-width: none; }
        }
      `}</style>
      <main className="public-page">{children}</main>
    </>
  )
}

function formatReportType(type: string) {
  const labels: Record<string, string> = {
    development_report: 'Relatório de desenvolvimento',
    planning: 'Planejamento',
    portfolio_text: 'Portfólio pedagógico',
    portfolio_image: 'Portfólio pedagógico',
    specialist_report: 'Relatório para especialista',
    general_report: 'Relatório pedagógico',
  }
  return labels[type] ?? 'Documento pedagógico'
}

function toDocumentHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '<p>Documento sem conteúdo.</p>'
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}
