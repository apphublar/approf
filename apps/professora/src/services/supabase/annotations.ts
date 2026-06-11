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
  attachmentFile?: File | null
}

export interface AnnotationUpdateInput extends AnnotationInput {
  annotationId: string
}

const DEFAULT_LOAD_DAYS = 90
const MAX_ROWS_PER_LOAD = 500

export async function loadSupabaseAnnotations(ownerId: string, classes: ClassData[], options?: { limitDays?: number | null }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const limitDays = options?.limitDays === null ? null : (options?.limitDays ?? DEFAULT_LOAD_DAYS)
  const since = limitDays !== null
    ? new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  let annotationsQuery = supabase
    .from('annotations')
    .select('id, category, body, tags, persistence, attachment_path, occurred_at')
    .eq('owner_id', ownerId)
    .order('occurred_at', { ascending: false })
    .limit(MAX_ROWS_PER_LOAD)

  if (since) {
    annotationsQuery = annotationsQuery.gte('occurred_at', since)
  }

  const [annotationsResult, targetsResult] = await Promise.all([
    annotationsQuery,
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

  const rows = annotationsResult.data ?? []
  const hasMore = rows.length === MAX_ROWS_PER_LOAD

  const mapped = await Promise.all(
    rows.map((annotation) =>
      mapAnnotation(annotation, targetsByAnnotationId.get(annotation.id) ?? [], studentById),
    ),
  )

  return { annotations: mapped, hasMore }
}

export async function countSupabaseAnnotationsForStudent(studentId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) return null

  const { count, error } = await supabase
    .from('annotation_targets')
    .select('annotation_id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('target_type', 'student')
    .eq('target_id', studentId)

  if (error) throw toError(error, 'Não foi possível contar as anotações da criança.')
  return count ?? 0
}

export async function deleteSupabaseAnnotation(annotationId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId)
    .eq('owner_id', ownerId)

  if (error) throw toError(error, 'Não foi possível excluir a anotação.')
}

export async function createSupabaseAnnotation(input: AnnotationInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

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

  if (error) throw toError(error, 'Não foi possível salvar a anotação no Supabase.')
  if (!data) throw new Error('Não foi possível salvar a anotação no Supabase.')

  const targets = buildTargets(data.id, ownerId, input)
  if (targets.length > 0) {
    const { error: targetError } = await supabase.from('annotation_targets').insert(targets)
    if (targetError) {
      await supabase.from('annotations').delete().eq('id', data.id).eq('owner_id', ownerId)
      throw toError(targetError, 'Não foi possível vincular a anotação ao destino selecionado.')
    }
  }

  let savedAnnotation = data
  if (input.attachmentFile) {
    try {
      const attachmentPath = await uploadAnnotationAttachment(ownerId, data.id, input.attachmentFile, input.studentId)
      const { data: updatedAnnotation, error: updateError } = await supabase
        .from('annotations')
        .update({ attachment_path: attachmentPath })
        .eq('id', data.id)
        .eq('owner_id', ownerId)
        .select('id, category, body, tags, persistence, attachment_path, occurred_at')
        .single()

      if (updateError) throw updateError
      if (updatedAnnotation) savedAnnotation = updatedAnnotation
    } catch (attachmentError) {
      await supabase.from('annotations').delete().eq('id', data.id).eq('owner_id', ownerId)
      throw toError(attachmentError, 'NÃ£o foi possÃ­vel enviar o anexo privado da anotaÃ§Ã£o.')
    }
  }

  const studentById = new Map<string, string>()
  return mapAnnotation(savedAnnotation, targets, studentById, input)
}

export async function updateSupabaseAnnotation(input: AnnotationUpdateInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const tags = [input.label, ...input.tags.filter((tag) => tag !== input.label)]
  const attachmentPath = input.attachmentFile
    ? await uploadAnnotationAttachment(ownerId, input.annotationId, input.attachmentFile, input.studentId)
    : undefined
  const { data, error } = await supabase
    .from('annotations')
    .update({
      category: input.category,
      body: input.text,
      tags,
      persistence: input.persistence,
      ...(attachmentPath ? { attachment_path: attachmentPath } : {}),
    })
    .eq('id', input.annotationId)
    .eq('owner_id', ownerId)
    .select('id, category, body, tags, persistence, attachment_path, occurred_at')
    .single()

  if (error) throw toError(error, 'Não foi possível atualizar a anotação no Supabase.')
  if (!data) throw new Error('Não foi possível atualizar a anotação no Supabase.')

  const { error: deleteTargetError } = await supabase
    .from('annotation_targets')
    .delete()
    .eq('annotation_id', input.annotationId)
    .eq('owner_id', ownerId)
  if (deleteTargetError) {
    throw toError(deleteTargetError, 'Não foi possível atualizar o destino da anotação.')
  }

  const targets = buildTargets(data.id, ownerId, input)
  if (targets.length > 0) {
    const { error: targetError } = await supabase.from('annotation_targets').insert(targets)
    if (targetError) {
      throw toError(targetError, 'Não foi possível vincular a anotação ao destino selecionado.')
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

async function mapAnnotation(
  annotation: AnnotationRow,
  targets: AnnotationTargetRow[],
  studentById: Map<string, string>,
  fallback?: AnnotationInput,
): Promise<Annotation> {
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
    attachmentUrl: annotation.attachment_path ? await getSignedAnnotationAttachmentUrl(annotation.attachment_path) : null,
    attachmentKind: annotation.attachment_path && isImagePath(annotation.attachment_path) ? 'image' : annotation.attachment_path ? 'file' : undefined,
    scope: teacherTarget ? 'personal' : undefined,
  }
}

function labelForCategory(category: AnnotationCategory) {
  const labels: Record<AnnotationCategory, string> = {
    evolucao: 'Evolução',
    plano: 'Planejamento',
    portfolio: 'Portfólio',
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

async function uploadAnnotationAttachment(ownerId: string, annotationId: string, file: File, studentId?: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nÃ£o estÃ¡ configurado.')

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = sanitizeFileName(file.name, extension)
  const ownerFolder = studentId ? `${ownerId}/${studentId}` : `${ownerId}/annotations`
  const path = `${ownerFolder}/annotations/${annotationId}-${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('child-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  })

  if (error) throw toError(error, 'NÃ£o foi possÃ­vel enviar o anexo privado da anotaÃ§Ã£o.')
  return path
}

async function getSignedAnnotationAttachmentUrl(path: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.storage.from('child-photos').createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) return null
  return data.signedUrl
}

function isImagePath(path: string) {
  return /\.(apng|avif|gif|jpe?g|png|webp)$/i.test(path)
}

function sanitizeFileName(fileName: string, fallbackExtension: string) {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  if (!sanitized) return `arquivo.${fallbackExtension}`
  return sanitized.includes('.') ? sanitized : `${sanitized}.${fallbackExtension}`
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
