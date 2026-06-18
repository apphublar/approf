export type CreatorMode = 'guided' | 'visual_portfolio' | 'free'

export type CreatorDocumentType =
  | 'individual_report'
  | 'portfolio_text'
  | 'daily_log'
  | 'weekly_plan'
  | 'lesson_plan'
  | 'project'
  | 'family_meeting'
  | 'pedagogical_referral'
  | 'other_pedagogical'
  | 'visual_portfolio_individual'
  | 'visual_cover'
  | 'visual_learning_panel'
  | 'visual_timeline'
  | 'visual_class_panel'
  | 'visual_project'
  | 'free_text'
  | 'free_image'

export type CreatorSourceMode =
  | 'prompt_only'
  | 'student_notes'
  | 'class_notes'
  | 'notes_and_prompt'

export type CreatorOutputFormat = 'text' | 'image'

export type CreatorBnccMode = 'auto' | 'required' | 'do_not_mention'

export type CreatorTone =
  | 'acolhedor'
  | 'objetivo'
  | 'detalhado'
  | 'simples'
  | 'formal'

export type CreatorVisualStyle =
  | 'delicado'
  | 'escolar'
  | 'moderno'
  | 'minimalista'
  | 'colorido'
  | 'ludico'

export type CreatorImageFormat = 'portrait' | 'landscape' | 'square'

export interface CreatorNoteRef {
  id: string
  date?: string
  label?: string
  text: string
}

export interface CreatorStudentContext {
  id?: string
  name?: string
  age?: string
  className?: string
}

export interface CreatorClassContext {
  id?: string
  name?: string
  ageGroup?: string
}

export interface CreatorPeriod {
  start?: string
  end?: string
}

export interface CreatorVisualOptions {
  visualTitle?: string
  subtitle?: string
  period?: string
  preferredColors?: string
  includeShortText?: boolean
}

export interface CreatorPayload {
  mode: CreatorMode
  documentType: CreatorDocumentType
  outputFormat: CreatorOutputFormat
  sourceMode: CreatorSourceMode
  title?: string
  teacherPrompt: string
  annotationIds?: string[]
  selectedNotes?: CreatorNoteRef[]
  studentContext?: CreatorStudentContext
  classContext?: CreatorClassContext
  period?: CreatorPeriod
  bnccMode?: CreatorBnccMode
  tone?: CreatorTone
  visualStyle?: CreatorVisualStyle
  imageFormat?: CreatorImageFormat
  visualOptions?: CreatorVisualOptions
}

export interface ImprovePromptPayload {
  mode: CreatorMode
  documentType?: CreatorDocumentType
  sourceMode?: CreatorSourceMode
  outputFormat?: CreatorOutputFormat
  teacherPrompt: string
  ageGroupOrContext?: string
  studentContext?: CreatorStudentContext
  classContext?: CreatorClassContext
}

export interface ImproveNotePayload {
  noteText: string
  label?: string
  studentName?: string
  className?: string
}
