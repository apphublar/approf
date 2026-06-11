export type DocumentFontFamily = 'arial' | 'times-new-roman'
export type LetterheadStyle = 'minimal' | 'centered' | 'watermark'
export type DocumentTextAlign = 'left' | 'justify' | 'center' | 'right'

export interface DocumentStyleSettings {
  fontFamily: DocumentFontFamily
  fontSizePt: number
  lineSpacing: number
  paragraphIndentCm: number
  textAlign: DocumentTextAlign
  boldTitles: boolean
  schoolLogoDataUrl: string | null
  letterheadStyle: LetterheadStyle
  schoolName: string
  schoolPeriod: string
  showSchoolNameInDocuments: boolean
  showSchoolPeriodInDocuments: boolean
  showTeacherNameInDocuments: boolean
}

const STORAGE_KEY = 'approf:document-style-settings'

export const DEFAULT_DOCUMENT_STYLE_SETTINGS: DocumentStyleSettings = {
  fontFamily: 'arial',
  fontSizePt: 12,
  lineSpacing: 1.5,
  paragraphIndentCm: 1.25,
  textAlign: 'justify',
  boldTitles: true,
  schoolLogoDataUrl: null,
  letterheadStyle: 'minimal',
  schoolName: '',
  schoolPeriod: '',
  showSchoolNameInDocuments: true,
  showSchoolPeriodInDocuments: false,
  showTeacherNameInDocuments: true,
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

export function textAlignLabel(value: DocumentTextAlign) {
  if (value === 'left') return 'Esquerda'
  if (value === 'center') return 'Centralizado'
  if (value === 'right') return 'Direita'
  return 'Justificado'
}

function sanitizeSettings(value: Partial<DocumentStyleSettings>): DocumentStyleSettings {
  const fontFamily: DocumentFontFamily = value.fontFamily === 'times-new-roman' ? 'times-new-roman' : 'arial'
  const lineSpacing = Number.isFinite(value.lineSpacing) ? Number(value.lineSpacing) : 1.5
  const fontSizePt = Number.isFinite(value.fontSizePt) ? Number(value.fontSizePt) : 12
  const paragraphIndentCm = Number.isFinite(value.paragraphIndentCm) ? Number(value.paragraphIndentCm) : 1.25
  const textAlign: DocumentTextAlign = value.textAlign === 'left' || value.textAlign === 'center' || value.textAlign === 'right'
    ? value.textAlign
    : 'justify'
  return {
    fontFamily,
    fontSizePt: Math.max(10, Math.min(16, Math.round(fontSizePt))),
    lineSpacing: [1, 1.15, 1.5, 2].includes(lineSpacing) ? lineSpacing : 1.5,
    paragraphIndentCm: Math.max(0, Math.min(2.5, Number(paragraphIndentCm.toFixed(2)))),
    textAlign,
    boldTitles: value.boldTitles !== false,
    schoolLogoDataUrl: typeof value.schoolLogoDataUrl === 'string' &&
      (value.schoolLogoDataUrl.startsWith('data:image/') || value.schoolLogoDataUrl.startsWith('https://'))
      ? value.schoolLogoDataUrl
      : null,
    letterheadStyle: value.letterheadStyle === 'centered' || value.letterheadStyle === 'watermark'
      ? value.letterheadStyle
      : 'minimal',
    schoolName: typeof value.schoolName === 'string' ? value.schoolName.trim() : '',
    schoolPeriod: typeof value.schoolPeriod === 'string' ? value.schoolPeriod.trim() : '',
    showSchoolNameInDocuments: value.showSchoolNameInDocuments !== false,
    showSchoolPeriodInDocuments: value.showSchoolPeriodInDocuments === true,
    showTeacherNameInDocuments: value.showTeacherNameInDocuments !== false,
  }
}

export function resolveDocumentExportContext(
  settings: DocumentStyleSettings,
  fallback: { teacherName?: string; schoolName?: string },
) {
  return {
    teacherName: settings.showTeacherNameInDocuments ? (fallback.teacherName?.trim() || 'Professora') : '',
    schoolName: settings.showSchoolNameInDocuments
      ? (settings.schoolName.trim() || fallback.schoolName?.trim() || 'Escola')
      : '',
    schoolPeriod: settings.showSchoolPeriodInDocuments ? settings.schoolPeriod.trim() : '',
  }
}
