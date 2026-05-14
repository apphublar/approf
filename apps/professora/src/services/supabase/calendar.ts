import type { CalendarEvent } from '@/types'
import { getSupabaseClient } from './client'

type CalendarEventRow = {
  id: string
  title: string
  notes: string | null
  event_date: string
  event_time: string | null
  remind: boolean
}

export interface CalendarEventInput {
  date: string
  title: string
  time?: string
  notes?: string
  remind: boolean
}

export async function loadSupabaseCalendarEvents() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, notes, event_date, event_time, remind')
    .eq('owner_id', ownerId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })

  if (error) throw toError(error, 'Não foi possível carregar os eventos do calendário.')
  return (data ?? []).map(mapCalendarEvent)
}

export async function createSupabaseCalendarEvent(input: CalendarEventInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      owner_id: ownerId,
      title: input.title,
      notes: input.notes || null,
      event_date: input.date,
      event_time: input.time || null,
      remind: input.remind,
    })
    .select('id, title, notes, event_date, event_time, remind')
    .single()

  if (error) throw toError(error, 'Não foi possível salvar o evento no calendário.')
  return mapCalendarEvent(data)
}

function mapCalendarEvent(event: CalendarEventRow): CalendarEvent {
  return {
    id: event.id,
    date: event.event_date,
    title: event.title,
    time: event.event_time?.slice(0, 5) || undefined,
    notes: event.notes ?? undefined,
    remind: event.remind,
  }
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
