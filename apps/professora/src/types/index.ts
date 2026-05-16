/* ── TYPES ── */

export type Tab = 'home' | 'annotations' | 'classes' | 'achievements' | 'materials'

export type Subscreen =
  | 'new-annotation'
  | 'class-students'
  | 'student-profile'
  | 'report'
  | 'ai'
  | 'giztokens'
  | 'documents'
  | 'generated-documents'
  | 'material-category'
  | 'editor'
  | 'community'
  | 'calendar'
  | 'new-class'
  | 'new-student'
  | 'edit-class'
  | 'edit-student'
  | 'find-child'
  | 'transfer-student'
  | 'new-timeline-event'
  | 'pedagogical-generator'
  | 'document-detail'
  | 'pending'

export type FeatureKey = 'community'

export interface FeatureAccess {
  global: boolean
  allowedUserIds: string[]
}

export interface CommunityPost {
  id: string
  authorName: string
  authorRole: string
  text: string
  category: 'duvida' | 'ideia' | 'material' | 'relato'
  likes: number
  comments: number
  createdAt: string
}

export interface CalendarEvent {
  id: string
  date: string
  title: string
  time?: string
  notes?: string
  remind: boolean
}

export interface AttendanceRecord {
  id: string
  classId: string
  date: string
  presentStudentIds: string[]
  createdAt: string
  updatedAt: string
}

export type AnnotationCategory =
  | 'evolucao'
  | 'plano'
  | 'portfolio'
  | 'projeto'
  | 'formacao'
  | 'carta'
  | 'atipico'

export interface Annotation {
  id: string
  category: AnnotationCategory
  label: string
  badgeClass: string
  studentName: string | null
  text: string
  date: string
  classId?: string
  studentId?: string
  tags?: string[]
  persistence?: AnnotationPersistence[]
  attachmentName?: string | null
  scope?: 'personal'
}

export type AnnotationPersistence =
  | 'relatorio-atual'
  | 'proximo-relatorio'
  | 'observacao-continua'
  | 'planejamento-futuro'
  | 'observacao-importante'
  | 'evolucao-positiva'

export type TimelineEventType =
  | 'evolucao'
  | 'atividade'
  | 'foto'
  | 'emocao'
  | 'alimentacao'
  | 'socializacao'
  | 'desenvolvimento'
  | 'marco'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  title: string
  text: string
  date: string
  tags?: string[]
  attachmentName?: string | null
  attachmentUrl?: string | null
  attachmentKind?: 'image' | 'file'
}

export interface DevelopmentAreas {
  linguagem: number
  socializacao: number
  coordenacao: number
  autonomia: number
}

export interface Student {
  id: string
  childCode: string
  name: string
  age: number
  ageMonths?: number
  birthDate?: string
  tag: string | null
  generalNotes?: string
  photoUrl?: string | null
  photoPosition?: string
  avatarBg: string
  avatarFg: string
  annotationCount: number
  development?: DevelopmentAreas
  timeline?: TimelineEvent[]
}

export interface ClassData {
  id: string
  name: string
  shift: string
  school: string
  ageGroup: string
  notes?: string
  iconBg: string
  students: Student[]
}

export interface BoardNote {
  id: string
  title: string
  body: string
  chalk: boolean
  expiresAt: string | null
}

export interface OnboardingData {
  schoolName: string
  shift: string
  className: string
  ageGroup: string
  estimatedStudentCount: number
  firstNote: string
}

export interface ChildSearchPreview {
  id: string
  childCode: string
  name: string
  birthDate: string
  school: string
  previousClass: string
  lastTeacher: string
  recordsCount: number
  timelineSummary: string[]
}

export type ReportStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'archived'

export interface GeneratedDocument {
  id: string
  owner_id: string
  student_id: string | null
  class_id: string | null
  status: ReportStatus
  report_type: string
  prompt_version: string | null
  body: string | null
  ai_artifacts?: {
    kind?: string
    imageDataUrl?: string
    prompt?: string
    model?: string
    size?: string
    quality?: string
  } | null
  is_final_version: boolean
  created_at: string
  updated_at: string
}

/** Documento pessoal da professora (certificados, diplomas, histórico etc.). */
export interface TeacherPersonalDocument {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  uploadedAt: string
}
