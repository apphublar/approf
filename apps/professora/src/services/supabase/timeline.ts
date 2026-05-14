import type { TimelineEvent, TimelineEventType } from '@/types'
import { getSupabaseClient } from './client'

type TimelineRow = {
  id: string
  student_id: string
  event_type: TimelineEventType
  title: string
  body: string
  tags: string[] | null
  attachment_path: string | null
  occurred_at: string
}

export interface TimelineEventInput {
  studentId: string
  type: TimelineEventType
  title: string
  text: string
  tags: string[]
  attachmentFile?: File | null
}

export async function createSupabaseTimelineEvent(input: TimelineEventInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const { data, error } = await supabase
    .from('student_timeline_events')
    .insert({
      owner_id: ownerId,
      student_id: input.studentId,
      event_type: input.type,
      title: input.title,
      body: input.text,
      tags: input.tags,
    })
    .select('id, student_id, event_type, title, body, tags, attachment_path, occurred_at')
    .single()

  if (error) throw toError(error, 'Nao foi possivel salvar o marco no Supabase.')

  let savedEvent = data
  if (input.attachmentFile) {
    const attachmentPath = await uploadTimelineAttachment(ownerId, input.studentId, data.id, input.attachmentFile)
    const { data: updatedEvent, error: updateError } = await supabase
      .from('student_timeline_events')
      .update({ attachment_path: attachmentPath })
      .eq('id', data.id)
      .eq('owner_id', ownerId)
      .select('id, student_id, event_type, title, body, tags, attachment_path, occurred_at')
      .single()

    if (updateError) throw toError(updateError, 'Marco salvo, mas nao foi possivel vincular a foto.')
    savedEvent = updatedEvent
  }

  return mapTimelineEvent(savedEvent)
}

export async function loadSupabaseTimelineEvents(ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data, error } = await supabase
    .from('student_timeline_events')
    .select('id, student_id, event_type, title, body, tags, attachment_path, occurred_at')
    .eq('owner_id', ownerId)
    .order('occurred_at', { ascending: false })

  if (error) throw error
  return Promise.all(
    (data ?? []).map(async (event) => ({
      studentId: event.student_id,
      event: await mapTimelineEvent(event),
    })),
  )
}

async function mapTimelineEvent(event: TimelineRow): Promise<TimelineEvent> {
  const attachmentUrl = event.attachment_path ? await getSignedTimelineAttachmentUrl(event.attachment_path) : null
  const attachmentKind = event.attachment_path && isImagePath(event.attachment_path) ? 'image' : event.attachment_path ? 'file' : undefined

  return {
    id: event.id,
    type: event.event_type,
    title: event.title,
    text: event.body,
    date: formatTimelineDate(event.occurred_at),
    tags: event.tags ?? [],
    attachmentName: event.attachment_path ? getFileName(event.attachment_path) : null,
    attachmentUrl,
    attachmentKind,
  }
}

async function uploadTimelineAttachment(ownerId: string, studentId: string, eventId: string, file: File) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = sanitizeFileName(file.name, extension)
  const path = `${ownerId}/${studentId}/timeline/${eventId}-${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('child-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  })

  if (error) throw toError(error, 'Nao foi possivel enviar a foto privada do marco.')
  return path
}

async function getSignedTimelineAttachmentUrl(path: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.storage.from('child-photos').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

function getFileName(path: string) {
  const rawName = path.split('/').pop() ?? 'Arquivo privado'
  return rawName.replace(/^[0-9a-f-]+-\d+-/i, '')
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

function formatTimelineDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  if (sameDay) return 'Hoje'
  return new Intl.DateTimeFormat('pt-BR').format(date)
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
