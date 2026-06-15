const STRUCTURED_FIELD_LABELS: Record<string, string> = {
  analysisText: 'Análise',
  evolutionRecord: 'Registro de evolução',
  generatedText: 'Conteúdo gerado',
  summary: 'Resumo',
  observations: 'Observações',
  recommendations: 'Recomendações',
  conclusion: 'Considerações finais',
  body: 'Conteúdo',
  text: 'Texto',
  content: 'Conteúdo',
  title: 'Título',
}

export function normalizeReportHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const fromJson = formatStructuredReportContent(parsed)
      if (fromJson) return fromJson
    } catch {
      // Continua com o fluxo padrão.
    }
  }

  const decoded = decodeHtmlEntities(trimmed)
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(decoded)
  if (hasHtml) return sanitizeReportHtml(decoded)

  const paragraphs = decoded
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)

  return paragraphs.join('')
}

export function sanitizeReportHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(href|src)="javascript:[^"]*"/gi, '')
    .replace(/\s(href|src)='javascript:[^']*'/gi, '')
}

function formatStructuredReportContent(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeReportHtml(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const content = formatStructuredReportContent(item)
        return content ? `<section><h3>Seção ${index + 1}</h3>${content}</section>` : ''
      })
      .filter(Boolean)
      .join('')
  }

  if (!value || typeof value !== 'object') return ''

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (item == null) return ''
      if (typeof item === 'string' && !item.trim()) return ''
      const label = STRUCTURED_FIELD_LABELS[key] || formatFieldLabel(key)
      if (typeof item === 'string') {
        return `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(item).replace(/\n/g, '<br>')}</p></section>`
      }
      if (typeof item === 'object') {
        const nested = formatStructuredReportContent(item)
        return nested ? `<section><h3>${escapeHtml(label)}</h3>${nested}</section>` : ''
      }
      return `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(String(item))}</p></section>`
    })
    .filter(Boolean)

  return entries.join('')
}

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatReportReviewStatus(status: string | null) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Correção solicitada'
  return 'Aguardando revisão'
}

export function mapReportStatusToBadge(status: string | null) {
  if (status === 'approved') return 'approved'
  if (status === 'changes_requested') return 'changes'
  return 'pending'
}

export function formatReviewAction(action: string) {
  if (action === 'approve') return 'Documento aprovado'
  if (action === 'request_changes') return 'Correção solicitada'
  if (action === 'comment') return 'Observação registrada'
  return action
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
