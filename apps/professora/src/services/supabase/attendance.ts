import type { AttendanceRecord } from '@/types'
import { getSupabaseClient } from './client'

type AttendanceRow = {
  id: string
  class_id: string
  attendance_date: string
  present_student_ids: string[]
  created_at: string
  updated_at: string
}

export interface AttendanceInput {
  classId: string
  date: string
  presentStudentIds: string[]
}

export async function loadSupabaseAttendanceRecords(ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, class_id, attendance_date, present_student_ids, created_at, updated_at')
    .eq('owner_id', ownerId)
    .order('attendance_date', { ascending: false })

  if (error) throw toError(error, 'Nao foi possivel carregar as chamadas.')
  return (data ?? []).map(mapAttendanceRecord)
}

export async function saveSupabaseAttendanceRecord(input: AttendanceInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(
      {
        owner_id: ownerId,
        class_id: input.classId,
        attendance_date: input.date,
        present_student_ids: input.presentStudentIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'class_id,attendance_date' },
    )
    .select('id, class_id, attendance_date, present_student_ids, created_at, updated_at')
    .single()

  if (error) throw toError(error, 'Nao foi possivel salvar a chamada.')
  return mapAttendanceRecord(data)
}

function mapAttendanceRecord(record: AttendanceRow): AttendanceRecord {
  return {
    id: record.id,
    classId: record.class_id,
    date: record.attendance_date,
    presentStudentIds: record.present_student_ids ?? [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
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
