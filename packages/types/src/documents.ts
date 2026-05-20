export type DocumentGenerationType =
  | 'classroom_journal'
  | 'development_report'
  | 'portfolio_text'
  | 'portfolio_image'
  | 'planning_daily'
  | 'planning_weekly'
  | 'planning_project'
  | 'planning_meeting'
  | 'specialist_referral'
  | 'parents_meeting'

export type AppDocumentGenerationType =
  | DocumentGenerationType
  | 'class_diary'
  | 'daily_lesson_plan'
  | 'weekly_planning'
  | 'pedagogical_project'
  | 'parents_meeting_record'
  | 'general_report'
  | 'planning'
  | 'specialist_report'
  | 'other'

export type DireitoAprendizagem =
  | 'conviver'
  | 'brincar'
  | 'participar'
  | 'explorar'
  | 'expressar'
  | 'conhecer-se'

export type CampoExperienciaBNCC =
  | 'eu_outro_nos'
  | 'corpo_gestos_movimentos'
  | 'tracos_sons_cores_formas'
  | 'escuta_fala_pensamento'
  | 'espacos_tempos_quantidades'

export const DIREITOS_LABELS: Record<DireitoAprendizagem, string> = {
  conviver: 'Conviver',
  brincar: 'Brincar',
  participar: 'Participar',
  explorar: 'Explorar',
  expressar: 'Expressar',
  'conhecer-se': 'Conhecer-se',
}

export const CAMPOS_BNCC_LABELS: Record<CampoExperienciaBNCC, string> = {
  eu_outro_nos: 'O eu, o outro e o nos',
  corpo_gestos_movimentos: 'Corpo, gestos e movimentos',
  tracos_sons_cores_formas: 'Tracos, sons, cores e formas',
  escuta_fala_pensamento: 'Escuta, fala, pensamento e imaginacao',
  espacos_tempos_quantidades: 'Espacos, tempos, quantidades e transformacoes',
}

export const FORBIDDEN_PEDAGOGICAL_WORDS = [
  'evidenciou',
  'no que tange',
  'em consonancia',
  'outrossim',
  'consoante',
  'destarte',
  'hodiernamente',
  'mister se faz',
  'apresentou deficit',
  'comprometimento cognitivo',
  'corrobora',
  'supracitado',
  'doravante',
  'haja vista',
] as const

export const DOCUMENT_MODELS: Record<DocumentGenerationType, {
  draft: 'haiku' | 'sonnet'
  review: 'haiku' | 'sonnet' | null
  refine: 'haiku' | 'sonnet' | null
}> = {
  classroom_journal: { draft: 'haiku', review: 'haiku', refine: null },
  development_report: { draft: 'haiku', review: 'sonnet', refine: 'sonnet' },
  portfolio_text: { draft: 'haiku', review: 'sonnet', refine: 'haiku' },
  portfolio_image: { draft: 'haiku', review: null, refine: null },
  planning_daily: { draft: 'haiku', review: 'haiku', refine: null },
  planning_weekly: { draft: 'haiku', review: 'haiku', refine: null },
  planning_project: { draft: 'sonnet', review: 'sonnet', refine: 'haiku' },
  planning_meeting: { draft: 'haiku', review: 'haiku', refine: null },
  specialist_referral: { draft: 'sonnet', review: 'sonnet', refine: 'haiku' },
  parents_meeting: { draft: 'haiku', review: null, refine: null },
}

export const DOCUMENT_WORD_LIMITS: Record<DocumentGenerationType, number> = {
  classroom_journal: 150,
  development_report: 600,
  portfolio_text: 500,
  portfolio_image: 0,
  planning_daily: 350,
  planning_weekly: 400,
  planning_project: 2000,
  planning_meeting: 500,
  specialist_referral: 450,
  parents_meeting: 280,
}

export const APP_DOCUMENT_TYPE_ALIASES: Record<string, DocumentGenerationType> = {
  class_diary: 'classroom_journal',
  classroom_journal: 'classroom_journal',
  development_report: 'development_report',
  portfolio_text: 'portfolio_text',
  portfolio_image: 'portfolio_image',
  daily_lesson_plan: 'planning_daily',
  planning_daily: 'planning_daily',
  weekly_planning: 'planning_weekly',
  planning_weekly: 'planning_weekly',
  pedagogical_project: 'planning_project',
  planning_project: 'planning_project',
  parents_meeting_record: 'planning_meeting',
  planning_meeting: 'planning_meeting',
  specialist_referral: 'specialist_referral',
  specialist_report: 'specialist_referral',
  parents_meeting: 'parents_meeting',
}

export function toCanonicalDocumentGenerationType(
  value: string,
): DocumentGenerationType | undefined {
  return APP_DOCUMENT_TYPE_ALIASES[value]
}
