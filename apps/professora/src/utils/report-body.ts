const STRUCTURED_FIELD_LABELS: Record<string, string> = {
  analysisText: 'Análise',
  evolutionRecord: 'Registro de evolução',
  generatedText: 'Conteúdo gerado',
  summary: 'Resumo',
  observations: 'Observações',
  recommendations: 'Recomendações',
  conclusion: 'Considerações finais',
  objective: 'Objetivo',
  howToApply: 'Como aplicar',
  whatToObserve: 'O que observar',
  recordText: 'Registro',
  title: 'Título',
  body: 'Conteúdo',
  text: 'Texto',
  content: 'Conteúdo',
  recommendedSuggestions: 'Sugestões recomendadas',
  suggestions: 'Sugestões',
}

export function normalizeReportBodyHtml(value: string) {
  const trimmed = stripMarkdownFromPedagogicalText(value.trim())
  if (!trimmed) return ''

  const structured = parseStructuredBody(trimmed)
  if (structured != null) {
    const fromStructured = formatStructuredReportContent(structured)
    if (fromStructured) return fromStructured
  }

  const decoded = decodeHtmlEntities(decodeUnicodeEscapes(trimmed))
  if (/<\/?[a-z][\s\S]*>/i.test(decoded)) {
    return sanitizeReportHtml(decoded)
  }

  return decoded
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function formatReportBodyPreview(value: string, maxLength = 150) {
  const html = normalizeReportBodyHtml(value)
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trim()}...`
}

export function structuredObjectToReadableText(value: unknown, depth = 0): string {
  if (value == null) return ''
  if (typeof value === 'string') return decodeUnicodeEscapes(value).trim()
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const block = structuredObjectToReadableText(item, depth + 1)
        return block ? `${depth === 0 ? `Sugestão ${index + 1}\n` : ''}${block}` : ''
      })
      .filter(Boolean)
      .join('\n\n')
  }
  if (typeof value !== 'object') return String(value)

  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (item == null) return ''
      const label = STRUCTURED_FIELD_LABELS[key] || formatFieldLabel(key)
      if (typeof item === 'string' && !item.trim()) return ''
      if (typeof item === 'string') return `${label}\n${decodeUnicodeEscapes(item).trim()}`
      if (Array.isArray(item) || typeof item === 'object') {
        const nested = structuredObjectToReadableText(item, depth + 1)
        return nested ? `${label}\n${nested}` : ''
      }
      return `${label}\n${String(item)}`
    })
    .filter(Boolean)
    .join('\n\n')
}

function parseStructuredBody(raw: string): unknown | null {
  const candidates = [
    raw.trim(),
    decodeUnicodeEscapes(raw.trim()),
    extractJsonBlock(raw),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // tenta próximo formato
    }

    if (!candidate.trim().startsWith('{')) {
      try {
        return JSON.parse(`{${candidate.trim()}}`)
      } catch {
        // continua
      }
    }
  }

  const loose = parseLooseKeyValueBody(raw)
  return loose && Object.keys(loose).length > 0 ? loose : null
}

function parseLooseKeyValueBody(raw: string) {
  const decoded = decodeUnicodeEscapes(raw)
  const entries: Record<string, unknown> = {}
  const stringFieldRegex = /"([a-zA-Z0-9_]+)"\s*:\s*"((?:\\.|[^"\\])*)"/g
  let match: RegExpExecArray | null = null

  while ((match = stringFieldRegex.exec(decoded)) !== null) {
    const key = match[1]
    const value = match[2]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\')
    if (value.trim()) entries[key] = value
  }

  return entries
}

function formatStructuredReportContent(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeReportBodyHtml(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>
          const title = typeof record.title === 'string' && record.title.trim()
            ? stripMarkdownFromPedagogicalText(record.title.trim())
            : `Sugestão ${index + 1}`
          const { title: _title, ...rest } = record
          const inner = formatStructuredReportContent(Object.keys(rest).length ? rest : record)
          return inner ? `<section><h3>${escapeHtml(title)}</h3>${inner}</section>` : ''
        }
        const content = formatStructuredReportContent(item)
        return content ? `<section><h3>Seção ${index + 1}</h3>${content}</section>` : ''
      })
      .filter(Boolean)
      .join('')
  }

  if (!value || typeof value !== 'object') return ''

  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (item == null) return ''
      if (typeof item === 'string' && !item.trim()) return ''
      const label = STRUCTURED_FIELD_LABELS[key] || formatFieldLabel(key)
      if (typeof item === 'string') {
        return `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(stripMarkdownFromPedagogicalText(decodeUnicodeEscapes(item))).replace(/\n/g, '<br>')}</p></section>`
      }
      if (Array.isArray(item) || typeof item === 'object') {
        const nested = formatStructuredReportContent(item)
        return nested ? `<section><h3>${escapeHtml(label)}</h3>${nested}</section>` : ''
      }
      return `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(String(item))}</p></section>`
    })
    .filter(Boolean)
    .join('')
}

function extractJsonBlock(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  return null
}

function decodeUnicodeEscapes(value: string) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function stripMarkdownFromPedagogicalText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/^={3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

function sanitizeReportHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(href|src)="javascript:[^"]*"/gi, '')
    .replace(/\s(href|src)='javascript:[^']*'/gi, '')
}
