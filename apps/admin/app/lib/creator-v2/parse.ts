import type {
  CreatorBnccMode,
  CreatorDocumentType,
  CreatorImageFormat,
  CreatorMode,
  CreatorNoteRef,
  CreatorOutputFormat,
  CreatorPayload,
  CreatorSourceMode,
  CreatorTone,
  CreatorVisualStyle,
  ImproveNotePayload,
  ImprovePromptPayload,
} from '@approf/types'
import { RECOMMENDED_PROMPTS } from './prompts'
import { documentTypeLabel, modeFromDocumentType, resolveDefaultBnccMode } from './mapping'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalString(value: unknown) {
  const text = asString(value)
  return text || undefined
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

const CREATOR_MODES = new Set<CreatorMode>(['guided', 'visual_portfolio', 'free'])
const SOURCE_MODES = new Set<CreatorSourceMode>([
  'prompt_only',
  'student_notes',
  'class_notes',
  'notes_and_prompt',
])
const OUTPUT_FORMATS = new Set<CreatorOutputFormat>(['text', 'image'])
const BNCC_MODES = new Set<CreatorBnccMode>(['auto', 'required', 'do_not_mention'])
const TONES = new Set<CreatorTone>(['acolhedor', 'objetivo', 'detalhado', 'simples', 'formal'])
const VISUAL_STYLES = new Set<CreatorVisualStyle>([
  'delicado', 'escolar', 'moderno', 'minimalista', 'colorido', 'ludico',
])
const IMAGE_FORMATS = new Set<CreatorImageFormat>(['portrait', 'landscape', 'square'])

const DOCUMENT_TYPES = new Set<CreatorDocumentType>([
  'individual_report', 'portfolio_text', 'daily_log', 'weekly_plan', 'lesson_plan',
  'project', 'family_meeting', 'pedagogical_referral', 'other_pedagogical',
  'visual_portfolio_individual', 'visual_cover', 'visual_learning_panel',
  'visual_timeline', 'visual_class_panel', 'visual_project', 'free_text', 'free_image',
])

function parseNotes(value: unknown): CreatorNoteRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: asString(item.id) || crypto.randomUUID(),
      date: asOptionalString(item.date),
      label: asOptionalString(item.label),
      text: asString(item.text),
    }))
    .filter((item) => item.text.length > 0)
}

function parseAnnotationIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function parseCreatorPayload(body: Record<string, unknown>): CreatorPayload {
  const creator = body.creator && typeof body.creator === 'object' && !Array.isArray(body.creator)
    ? body.creator as Record<string, unknown>
    : body

  const documentTypeRaw = asString(creator.documentType)
  if (!DOCUMENT_TYPES.has(documentTypeRaw as CreatorDocumentType)) {
    throw new Error('Tipo de documento inválido.')
  }
  const documentType = documentTypeRaw as CreatorDocumentType

  const modeRaw = asString(creator.mode)
  const mode = CREATOR_MODES.has(modeRaw as CreatorMode)
    ? modeRaw as CreatorMode
    : modeFromDocumentType(documentType)

  const outputFormatRaw = asString(creator.outputFormat)
  const outputFormat = OUTPUT_FORMATS.has(outputFormatRaw as CreatorOutputFormat)
    ? outputFormatRaw as CreatorOutputFormat
    : documentType === 'free_image' || documentType.startsWith('visual_')
      ? 'image'
      : 'text'

  const sourceModeRaw = asString(creator.sourceMode)
  const sourceMode = SOURCE_MODES.has(sourceModeRaw as CreatorSourceMode)
    ? sourceModeRaw as CreatorSourceMode
    : 'prompt_only'

  const bnccModeRaw = asString(creator.bnccMode)
  const bnccMode = BNCC_MODES.has(bnccModeRaw as CreatorBnccMode)
    ? bnccModeRaw as CreatorBnccMode
    : resolveDefaultBnccMode(documentType)

  const toneRaw = asString(creator.tone)
  const tone = TONES.has(toneRaw as CreatorTone) ? toneRaw as CreatorTone : 'acolhedor'

  const visualStyleRaw = asString(creator.visualStyle)
  const visualStyle = VISUAL_STYLES.has(visualStyleRaw as CreatorVisualStyle)
    ? visualStyleRaw as CreatorVisualStyle
    : 'escolar'

  const imageFormatRaw = asString(creator.imageFormat)
  const imageFormat = IMAGE_FORMATS.has(imageFormatRaw as CreatorImageFormat)
    ? imageFormatRaw as CreatorImageFormat
    : 'portrait'

  const studentContext = creator.studentContext && typeof creator.studentContext === 'object'
    ? creator.studentContext as CreatorPayload['studentContext']
    : undefined
  const classContext = creator.classContext && typeof creator.classContext === 'object'
    ? creator.classContext as CreatorPayload['classContext']
    : undefined
  const period = creator.period && typeof creator.period === 'object'
    ? creator.period as CreatorPayload['period']
    : undefined
  const visualOptions = creator.visualOptions && typeof creator.visualOptions === 'object'
    ? creator.visualOptions as CreatorPayload['visualOptions']
    : undefined

  return {
    mode,
    documentType,
    outputFormat,
    sourceMode,
    title: asOptionalString(creator.title),
    teacherPrompt: asString(creator.teacherPrompt),
    annotationIds: parseAnnotationIds(creator.annotationIds),
    selectedNotes: parseNotes(creator.selectedNotes),
    studentContext,
    classContext,
    period,
    bnccMode,
    tone,
    visualStyle,
    imageFormat,
    visualOptions,
  }
}

export function parseImprovePromptPayload(body: Record<string, unknown>): ImprovePromptPayload {
  const teacherPrompt = asString(body.teacherPrompt)
  if (teacherPrompt.length < 8) {
    throw new Error('Escreva um pedido mínimo antes de aprimorar.')
  }
  const modeRaw = asString(body.mode)
  const mode = CREATOR_MODES.has(modeRaw as CreatorMode) ? modeRaw as CreatorMode : 'guided'
  const documentTypeRaw = asString(body.documentType)
  const documentType = DOCUMENT_TYPES.has(documentTypeRaw as CreatorDocumentType)
    ? documentTypeRaw as CreatorDocumentType
    : undefined
  return {
    mode,
    documentType,
    sourceMode: SOURCE_MODES.has(asString(body.sourceMode) as CreatorSourceMode)
      ? asString(body.sourceMode) as CreatorSourceMode
      : undefined,
    outputFormat: OUTPUT_FORMATS.has(asString(body.outputFormat) as CreatorOutputFormat)
      ? asString(body.outputFormat) as CreatorOutputFormat
      : undefined,
    teacherPrompt,
    ageGroupOrContext: asOptionalString(body.ageGroupOrContext),
    studentContext: body.studentContext && typeof body.studentContext === 'object'
      ? body.studentContext as ImprovePromptPayload['studentContext']
      : undefined,
    classContext: body.classContext && typeof body.classContext === 'object'
      ? body.classContext as ImprovePromptPayload['classContext']
      : undefined,
  }
}

export function parseImproveNotePayload(body: Record<string, unknown>): ImproveNotePayload {
  const noteText = asString(body.noteText)
  if (noteText.length < 12) {
    throw new Error('Escreva a anotação antes de aprimorar.')
  }
  return {
    noteText,
    label: asOptionalString(body.label),
    studentName: asOptionalString(body.studentName),
    className: asOptionalString(body.className),
  }
}

export function formatNotesBlock(notes: CreatorNoteRef[]) {
  if (!notes.length) return 'Nenhuma anotação selecionada.'
  return notes.map((note) => {
    const header = [note.date, note.label].filter(Boolean).join(' | ')
    return header ? `- ${header}: ${note.text}` : `- ${note.text}`
  }).join('\n')
}

export function buildCreatorUserPrompt(payload: CreatorPayload, notes: CreatorNoteRef[]) {
  const teacherPrompt = payload.teacherPrompt.trim()
    || RECOMMENDED_PROMPTS[payload.documentType]
    || 'Siga as instruções do tipo de documento selecionado.'

  const studentBlock = payload.studentContext
    ? [
        payload.studentContext.name ? `Nome: ${payload.studentContext.name}` : null,
        payload.studentContext.age ? `Idade/faixa: ${payload.studentContext.age}` : null,
        payload.studentContext.className ? `Turma: ${payload.studentContext.className}` : null,
      ].filter(Boolean).join('\n') || 'Não informado.'
    : 'Não informado.'

  const classBlock = payload.classContext
    ? [
        payload.classContext.name ? `Turma: ${payload.classContext.name}` : null,
        payload.classContext.ageGroup ? `Faixa etária: ${payload.classContext.ageGroup}` : null,
      ].filter(Boolean).join('\n') || 'Não informado.'
    : 'Não informado.'

  const periodBlock = payload.period?.start || payload.period?.end
    ? `${payload.period?.start ?? '?'} até ${payload.period?.end ?? '?'}`
    : 'Não informado.'

  const visualBlock = payload.visualOptions
    ? [
        payload.visualOptions.visualTitle ? `Título visual: ${payload.visualOptions.visualTitle}` : null,
        payload.visualOptions.subtitle ? `Subtítulo: ${payload.visualOptions.subtitle}` : null,
        payload.visualOptions.period ? `Período visual: ${payload.visualOptions.period}` : null,
        payload.visualOptions.preferredColors ? `Cores: ${payload.visualOptions.preferredColors}` : null,
        payload.visualOptions.includeShortText === false ? 'Sem texto na imagem' : 'Pode incluir frases curtas na imagem',
      ].filter(Boolean).join('\n')
    : ''

  return [
    'INSTRUÇÕES DA PROFESSORA — PRIORIDADE MÁXIMA:',
    teacherPrompt,
    '',
    'CONFIGURAÇÃO:',
    `Modo: ${payload.mode}`,
    `Tipo: ${documentTypeLabel(payload.documentType)} (${payload.documentType})`,
    `Formato: ${payload.outputFormat}`,
    `Fonte: ${payload.sourceMode}`,
    `Título do documento: ${payload.title ?? 'Sem título'}`,
    `Tom: ${payload.tone ?? 'acolhedor'}`,
    `BNCC: ${payload.bnccMode ?? 'auto'}`,
    `Período: ${periodBlock}`,
    payload.visualStyle ? `Estilo visual: ${payload.visualStyle}` : null,
    payload.imageFormat ? `Formato da imagem: ${payload.imageFormat}` : null,
    visualBlock ? `\nOPÇÕES VISUAIS:\n${visualBlock}` : null,
    '',
    'CONTEXTO DA CRIANÇA:',
    studentBlock,
    '',
    'CONTEXTO DA TURMA:',
    classBlock,
    '',
    'ANOTAÇÕES SELECIONADAS:',
    formatNotesBlock(notes),
    '',
    'REGRAS:',
    '- use as anotações como evidência principal quando existirem;',
    '- não invente fatos;',
    '- não compare crianças;',
    '- não use diagnóstico;',
    '- entregue somente o resultado final.',
  ].filter(Boolean).join('\n')
}

export function buildImprovePromptUser(payload: ImprovePromptPayload) {
  return [
    'Melhore o prompt abaixo para que ele gere um resultado de alta qualidade.',
    'Preserve a intenção da professora, organize melhor as instruções, inclua detalhes pedagógicos úteis quando aplicável e deixe claro o formato esperado.',
    'Não invente dados específicos sobre crianças, turmas, anotações, datas ou situações.',
    'Retorne apenas o prompt aprimorado, pronto para ser editado pela professora.',
    '',
    `Modo: ${payload.mode}`,
    payload.documentType ? `Tipo: ${payload.documentType}` : null,
    payload.sourceMode ? `Fonte do conteúdo: ${payload.sourceMode}` : null,
    payload.outputFormat ? `Formato: ${payload.outputFormat}` : null,
    payload.ageGroupOrContext ? `Contexto: ${payload.ageGroupOrContext}` : null,
    '',
    'Prompt original:',
    payload.teacherPrompt,
  ].filter(Boolean).join('\n')
}

export function buildImproveNoteUser(payload: ImproveNotePayload) {
  return [
    'Melhore a redação desta anotação pedagógica.',
    'Mantenha os fatos observados. Torne o texto mais claro e profissional.',
    'Não invente informações.',
    '',
    payload.label ? `Categoria: ${payload.label}` : null,
    payload.studentName ? `Criança: ${payload.studentName}` : null,
    payload.className ? `Turma: ${payload.className}` : null,
    '',
    'Anotação:',
    payload.noteText,
  ].filter(Boolean).join('\n')
}
