import type { InterventionHistoryItem, InterventionReturnChoice, InterventionSuggestion } from '@/types'
import { getSupabaseClient } from './client'

type InterventionRow = {
  id: string
  owner_id: string
  student_id: string
  class_id: string
  status: InterventionHistoryItem['status']
  observation_initial: string
  suggestions: InterventionSuggestion[] | null
  chosen_intervention: InterventionSuggestion | null
  teacher_return: string | null
  return_choice: InterventionReturnChoice | null
  ai_analysis: string | null
  evolution_record: string | null
  created_at: string
  students?: { full_name: string | null } | { full_name: string | null }[] | null
  classes?: { name: string | null } | { name: string | null }[] | null
}

export async function loadInterventionRecords(ownerId: string): Promise<InterventionHistoryItem[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('intervention_records')
    .select('id, student_id, class_id, status, observation_initial, suggestions, chosen_intervention, teacher_return, return_choice, ai_analysis, evolution_record, created_at, students(full_name), classes(name)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as InterventionRow[] | null ?? []).map(mapInterventionRow)
}

export async function saveInterventionRecord(item: InterventionHistoryItem): Promise<InterventionHistoryItem> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const payload = {
    owner_id: ownerId,
    student_id: item.studentId,
    class_id: item.classId,
    status: item.status,
    observation_initial: item.observationInitial,
    suggestions: item.suggestions,
    chosen_intervention: item.chosenIntervention ?? null,
    teacher_return: item.teacherReturn ?? null,
    return_choice: item.returnChoice ?? null,
    ai_analysis: item.aiAnalysis ?? null,
    evolution_record: item.evolutionRecord ?? null,
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)
  if (isUuid) {
    const { data, error } = await supabase
      .from('intervention_records')
      .update(payload)
      .eq('id', item.id)
      .eq('owner_id', ownerId)
      .select('id, student_id, class_id, status, observation_initial, suggestions, chosen_intervention, teacher_return, return_choice, ai_analysis, evolution_record, created_at, students(full_name), classes(name)')
      .single()
    if (error) throw error
    return mapInterventionRow(data as InterventionRow)
  }

  const { data, error } = await supabase
    .from('intervention_records')
    .insert(payload)
    .select('id, student_id, class_id, status, observation_initial, suggestions, chosen_intervention, teacher_return, return_choice, ai_analysis, evolution_record, created_at, students(full_name), classes(name)')
    .single()
  if (error) throw error
  return mapInterventionRow(data as InterventionRow)
}

export async function deleteInterventionRecord(id: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { error } = await supabase.from('intervention_records').delete().eq('id', id)
  if (error) throw error
}

function mapInterventionRow(row: InterventionRow): InterventionHistoryItem {
  const student = Array.isArray(row.students) ? row.students[0] : row.students
  const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: student?.full_name?.trim() || 'Criança',
    classId: row.class_id,
    className: classData?.name?.trim() || 'Turma',
    createdAt: formatInterventionDate(row.created_at),
    observationInitial: row.observation_initial ?? '',
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    chosenIntervention: row.chosen_intervention ?? undefined,
    teacherReturn: row.teacher_return ?? undefined,
    returnChoice: row.return_choice ?? undefined,
    aiAnalysis: row.ai_analysis ?? undefined,
    evolutionRecord: row.evolution_record ?? undefined,
    status: row.status,
  }
}

function formatInterventionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recente'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
