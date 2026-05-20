export type DocumentFontFamily = 'arial' | 'times-new-roman'
export type LetterheadStyle = 'minimal' | 'centered' | 'watermark'

export interface DocumentStyleSettings {
  fontFamily: DocumentFontFamily
  fontSizePt: number
  lineSpacing: number
  paragraphIndentCm: number
  justified: boolean
  schoolLogoDataUrl: string | null
  letterheadStyle: LetterheadStyle
}

const STORAGE_KEY = 'approf:document-style-settings'

export const DEFAULT_DOCUMENT_STYLE_SETTINGS: DocumentStyleSettings = {
  fontFamily: 'arial',
  fontSizePt: 12,
  lineSpacing: 1.5,
  paragraphIndentCm: 1.25,
  justified: true,
  schoolLogoDataUrl: null,
  letterheadStyle: 'minimal',
}

export function loadDocumentStyleSettings(): DocumentStyleSettings {
  if (typeof window === 'undefined') return DEFAULT_DOCUMENT_STYLE_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DOCUMENT_STYLE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<DocumentStyleSettings>
    return sanitizeSettings(parsed)
  } catch {
    return DEFAULT_DOCUMENT_STYLE_SETTINGS
  }
}

export function saveDocumentStyleSettings(next: Partial<DocumentStyleSettings>) {
  if (typeof window === 'undefined') return
  const merged = sanitizeSettings({ ...loadDocumentStyleSettings(), ...next })
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
}

export function fontFamilyLabel(value: DocumentFontFamily) {
  return value === 'times-new-roman' ? 'Times New Roman' : 'Arial'
}

export function fontFamilyCss(value: DocumentFontFamily) {
  return value === 'times-new-roman'
    ? '"Times New Roman", Times, serif'
    : 'Arial, Helvetica, sans-serif'
}

function sanitizeSettings(value: Partial<DocumentStyleSettings>): DocumentStyleSettings {
  const fontFamily: DocumentFontFamily = value.fontFamily === 'times-new-roman' ? 'times-new-roman' : 'arial'
  const lineSpacing = Number.isFinite(value.lineSpacing) ? Number(value.lineSpacing) : 1.5
  const fontSizePt = Number.isFinite(value.fontSizePt) ? Number(value.fontSizePt) : 12
  const paragraphIndentCm = Number.isFinite(value.paragraphIndentCm) ? Number(value.paragraphIndentCm) : 1.25
  return {
    fontFamily,
    fontSizePt: Math.max(10, Math.min(16, Math.round(fontSizePt))),
    lineSpacing: [1, 1.15, 1.5, 2].includes(lineSpacing) ? lineSpacing : 1.5,
    paragraphIndentCm: Math.max(0, Math.min(2.5, Number(paragraphIndentCm.toFixed(2)))),
    justified: value.justified !== false,
    schoolLogoDataUrl: typeof value.schoolLogoDataUrl === 'string' && value.schoolLogoDataUrl.startsWith('data:image/')
      ? value.schoolLogoDataUrl
      : null,
    letterheadStyle: value.letterheadStyle === 'centered' || value.letterheadStyle === 'watermark'
      ? value.letterheadStyle
      : 'minimal',
  }
}
