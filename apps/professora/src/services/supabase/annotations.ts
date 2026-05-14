import type { Annotation, AnnotationCategory, AnnotationPersistence, ClassData } from '@/types'
import { getSupabaseClient } from './client'

type AnnotationTargetType = 'student' | 'class' | 'school' | 'teacher'

type AnnotationRow = {
  id: string
  category: AnnotationCategory
  body: string
  tags: string[] | null
  persistence: AnnotationPersistence[] | null
  attachment_path: string | null
  occurred_at: string
}

type AnnotationTargetRow = {
  annotation_id: string
  target_type: AnnotationTargetType
  target_id: string | null
}

export interface AnnotationInput {
  category: AnnotationCategory
  label: string
  text: string
  classId?: string
  studentId?: string
  studentName?: string | null
  tags: string[]
  persistence: AnnotationPersistence[]
  attachmentName?: string | null
}

export async function loadSupabaseAnnotations(ownerId: string, classes: ClassData[]) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const [annotationsResult, targetsResult] = await Promise.all([
    supabase
      .from('annotations')
      .select('id, category, body, tags, persistence, attachment_path, occurred_at')
      .eq('owner_id', ownerId)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('annotation_targets')
      .select('annotation_id, target_type, target_id')
      .eq('owner_id', ownerId),
  ])

  if (annotationsResult.error) throw annotationsResult.error
  if (targetsResult.error) throw targetsResult.error

  const studentById = new Map(classes.flatMap((cls) => cls.students.map((student) => [student.id, student.name] as const)))
  const targetsByAnnotationId = new Map<string, AnnotationTargetRow[]>()
  ;(targetsResult.data ?? []).forEach((target) => {
    const current = targetsByAnnotationId.get(target.annotation_id) ?? []
    current.push(target)
    targetsByAnnotationId.set(target.annotation_id, current)
  })

  return (annotationsResult.data ?? []).map((annotation) =>
    mapAnnotation(annotation, targetsByAnnotationId.get(annotation.id) ?? [], studentById),
  )
}

export async function createSupabaseAnnotation(input: AnnotationInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const tags = [input.label, ...input.tags.filter((tag) => tag !== input.label)]
  const { data, error } = await supabase
    .from('annotations')
    .insert({
      owner_id: ownerId,
      category: input.category,
      body: input.text,
      tags,
      persistence: input.persistence,
      attachment_path: null,
    })
    .select('id, category, body, tags, persistence, attachment_path, occurred_at')
    .single()

  if (error) throw toError(error, 'Nao foi possivel salvar a anotacao no Supabase.')
  if (!data) throw new Error('Nao foi possivel salvar a anotacao no Supabase.')

  const targets = buildTargets(data.id, ownerId, input)
  if (targets.length > 0) {
    const { error: targetError } = await supabase.from('annotation_targets').insert(targets)
    if (targetError) {
      await supabase.from('annotations').delete().eq('id', data.id).eq('owner_id', ownerId)
      throw toError(targetError, 'Nao foi possivel vincular a anotacao ao destino selecionado.')
    }
  }

  const studentById = new Map<string, string>()
  return mapAnnotation(data, targets, studentById, input)
}

function buildTargets(annotationId: string, ownerId: string, input: AnnotationInput) {
  const targets: Array<{
    annotation_id: string
    owner_id: string
    target_type: AnnotationTargetType
    target_id: string | null
  }> = []

  if (input.studentId) {
    targets.push({ annotation_id: annotationId, owner_id: ownerId, target_type: 'student', target_id: input.studentId })
  }
  if (input.classId) {
    targets.push({ annotation_id: annotationId, owner_id: ownerId, target_type: 'class', target_id: input.classId })
  }
  if (targets.length === 0) {
    targets.push({ annotation_id: annotationId, owner_id: ownerId, target_type: 'teacher', target_id: ownerId })
  }

  return targets
}

function mapAnnotation(
  annotation: AnnotationRow,
  targets: AnnotationTargetRow[],
  studentById: Map<string, string>,
  fallback?: AnnotationInput,
): Annotation {
  const studentTarget = targets.find((target) => target.target_type === 'student' && target.target_id)
  const classTarget = targets.find((target) => target.target_type === 'class' && target.target_id)
  const teacherTarget = targets.find((target) => target.target_type === 'teacher')
  const tags = annotation.tags ?? []
  const label = fallback?.label ?? tags[0] ?? labelForCategory(annotation.category)
  const studentName = fallback?.studentName
    ?? (studentTarget?.target_id
      ? studentById.get(studentTarget.target_id) ?? null
      : null)

  return {
    id: annotation.id,
    category: annotation.category,
    label,
    badgeClass: 'badge-ev',
    studentName,
    text: annotation.body,
    date: formatAnnotationDate(annotation.occurred_at),
    classId: fallback?.classId ?? classTarget?.target_id ?? undefined,
    studentId: fallback?.studentId ?? studentTarget?.target_id ?? undefined,
    tags,
    persistence: annotation.persistence ?? [],
    attachmentName: annotation.attachment_path ? getFileName(annotation.attachment_path) : null,
    scope: teacherTarget ? 'personal' : undefined,
  }
}

function labelForCategory(category: AnnotationCategory) {
  const labels: Record<AnnotationCategory, string> = {
    evolucao: 'Evolucao',
    plano: 'Planejamento',
    portfolio: 'Portfolio',
    projeto: 'Projeto',
    formacao: 'Formacao',
    carta: 'Comunicado',
    atipico: 'Atipico',
  }
  return labels[category]
}

function formatAnnotationDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  if (sameDay) {
    return `Hoje, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}`
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getFileName(path: string) {
  return path.split('/').pop() ?? 'Arquivo privado'
}

function toError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallbackMessage)
}
