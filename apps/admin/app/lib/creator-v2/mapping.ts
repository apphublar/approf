import type {
  CreatorBnccMode,
  CreatorDocumentType,
  CreatorMode,
} from '@approf/types'
import type { AiGenerationType } from '../ai-usage'

export function mapDocumentTypeToGenerationType(documentType: CreatorDocumentType): AiGenerationType {
  switch (documentType) {
    case 'individual_report':
      return 'development_report'
    case 'portfolio_text':
      return 'portfolio_text'
    case 'daily_log':
      return 'class_diary'
    case 'weekly_plan':
      return 'weekly_planning'
    case 'lesson_plan':
      return 'daily_lesson_plan'
    case 'project':
      return 'pedagogical_project'
    case 'family_meeting':
      return 'parents_meeting_record'
    case 'pedagogical_referral':
      return 'specialist_referral'
    case 'other_pedagogical':
      return 'general_report'
    case 'visual_portfolio_individual':
    case 'visual_cover':
    case 'visual_learning_panel':
    case 'visual_timeline':
    case 'visual_class_panel':
    case 'visual_project':
      return 'portfolio_image'
    case 'free_text':
      return 'general_report'
    case 'free_image':
      return 'other'
    default:
      return 'general_report'
  }
}

export function resolveDefaultBnccMode(documentType: CreatorDocumentType): CreatorBnccMode {
  switch (documentType) {
    case 'weekly_plan':
    case 'lesson_plan':
    case 'project':
      return 'required'
    case 'daily_log':
    case 'portfolio_text':
    case 'family_meeting':
      return 'do_not_mention'
    default:
      return 'auto'
  }
}

export function documentTypeLabel(documentType: CreatorDocumentType): string {
  const labels: Record<CreatorDocumentType, string> = {
    individual_report: 'Relatório de Desenvolvimento Individual',
    portfolio_text: 'Portfólio Escrito',
    daily_log: 'Diário de Bordo',
    weekly_plan: 'Planejamento Semanal',
    lesson_plan: 'Plano de Aula',
    project: 'Projeto Pedagógico',
    family_meeting: 'Reunião com Família',
    pedagogical_referral: 'Encaminhamento Pedagógico',
    other_pedagogical: 'Outro Documento Pedagógico',
    visual_portfolio_individual: 'Portfólio Individual da Criança',
    visual_cover: 'Capa de Portfólio',
    visual_learning_panel: 'Painel de Aprendizagens',
    visual_timeline: 'Linha do Tempo Visual',
    visual_class_panel: 'Painel da Turma',
    visual_project: 'Projeto Pedagógico Visual',
    free_text: 'Texto livre',
    free_image: 'Imagem livre',
  }
  return labels[documentType]
}

export function modeFromDocumentType(documentType: CreatorDocumentType): CreatorMode {
  if (documentType === 'free_text' || documentType === 'free_image') return 'free'
  if (documentType.startsWith('visual_')) return 'visual_portfolio'
  return 'guided'
}
