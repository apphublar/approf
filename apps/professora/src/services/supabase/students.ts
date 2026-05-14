import type { Student } from '@/types'
import { getSavedPhotoAdjustment, savePhotoAdjustment } from '@/utils/photo'
import { toTitleCaseName } from '@/utils/text'
import { getSupabaseClient } from './client'

const DEFAULT_PHOTO_POSITION = '50% 50% 120%'
const STUDENT_SELECT = 'id, full_name, birth_date, photo_path, notes_private, support_tags'
const STUDENT_SELECT_WITH_POSITION = 'id, full_name, birth_date, photo_path, photo_position, notes_private, support_tags'

type SupabaseStudentRow = {
  id: string
  full_name: string
  birth_date: string | null
  photo_path: string | null
  photo_position?: string | null
  notes_private: string | null
  support_tags: string[] | null
}

export interface StudentInput {
  classId: string
  name: string
  birthDate?: string
  tag: string | null
  generalNotes?: string
  photoFile?: File | null
  photoPosition?: string
}

export async function createSupabaseStudent(input: StudentInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const studentInsert = {
    owner_id: ownerId,
    class_id: input.classId,
    full_name: input.name,
    birth_date: input.birthDate || null,
    notes_private: input.generalNotes || null,
    support_tags: input.tag ? [input.tag] : [],
  }

  const initialResult = await supabase
    .from('students')
    .insert({
      ...studentInsert,
      photo_position: input.photoPosition ?? DEFAULT_PHOTO_POSITION,
    })
    .select(STUDENT_SELECT_WITH_POSITION)
    .single()
  let data: SupabaseStudentRow | null = initialResult.data
  let error = initialResult.error

  if (isMissingPhotoPositionError(error)) {
    const fallback = await supabase
      .from('students')
      .insert(studentInsert)
      .select(STUDENT_SELECT)
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) throw toError(error, 'Nao foi possivel criar a crianca no Supabase.')
  if (!data) throw new Error('Nao foi possivel criar a crianca no Supabase.')

  let savedStudent = data
  if (input.photoFile) {
    const photoPath = await uploadChildPhoto(ownerId, data.id, input.photoFile)
    let update = await supabase
      .from('students')
      .update({
        photo_path: photoPath,
        photo_position: input.photoPosition ?? DEFAULT_PHOTO_POSITION,
      })
      .eq('id', data.id)
      .eq('owner_id', ownerId)
      .select(STUDENT_SELECT_WITH_POSITION)
      .single()

    if (isMissingPhotoPositionError(update.error)) {
      update = await supabase
        .from('students')
        .update({ photo_path: photoPath })
        .eq('id', data.id)
        .eq('owner_id', ownerId)
        .select(STUDENT_SELECT)
        .single()
    }

    if (update.error) throw toError(update.error, 'Foto enviada, mas nao foi possivel vincular ao cadastro.')
    if (!update.data) throw new Error('Foto enviada, mas nao foi possivel vincular ao cadastro.')
    savedStudent = update.data
  }

  if (input.photoPosition) savePhotoAdjustment(savedStudent.id, input.photoPosition)
  return mapSupabaseStudent(savedStudent)
}

export async function updateSupabaseStudent(studentId: string, input: StudentInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const photoPath = input.photoFile ? await uploadChildPhoto(ownerId, studentId, input.photoFile) : undefined
  const updatePayload = {
    class_id: input.classId,
    full_name: input.name,
    birth_date: input.birthDate || null,
    notes_private: input.generalNotes || null,
    support_tags: input.tag ? [input.tag] : [],
    ...(photoPath ? { photo_path: photoPath } : {}),
  }
  const initialResult = await supabase
    .from('students')
    .update({
      ...updatePayload,
      photo_position: input.photoPosition ?? DEFAULT_PHOTO_POSITION,
    })
    .eq('id', studentId)
    .eq('owner_id', ownerId)
    .select(STUDENT_SELECT_WITH_POSITION)
    .single()
  let data: SupabaseStudentRow | null = initialResult.data
  let error = initialResult.error

  if (isMissingPhotoPositionError(error)) {
    const fallback = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', studentId)
      .eq('owner_id', ownerId)
      .select(STUDENT_SELECT)
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) throw toError(error, 'Nao foi possivel atualizar a crianca no Supabase.')
  if (!data) throw new Error('Nao foi possivel atualizar a crianca no Supabase.')
  if (input.photoPosition) savePhotoAdjustment(data.id, input.photoPosition)
  return mapSupabaseStudent(data)
}

export async function mapSupabaseStudent(student: SupabaseStudentRow): Promise<Student> {
  const age = calculateAgeParts(student.birth_date ?? '')
  const tag = student.support_tags?.[0] ?? null
  const photoUrl = student.photo_path ? await getSignedChildPhotoUrl(student.photo_path) : null
  const savedPhotoPosition = getSavedPhotoAdjustment(student.id)
  const photoPosition =
    student.photo_position && student.photo_position !== DEFAULT_PHOTO_POSITION
      ? student.photo_position
      : savedPhotoPosition ?? student.photo_position ?? DEFAULT_PHOTO_POSITION

  return {
    id: student.id,
    childCode: `CRI-${student.id.slice(0, 8).toUpperCase()}`,
    name: toTitleCaseName(student.full_name),
    age: age.years,
    ageMonths: age.months,
    birthDate: student.birth_date ?? undefined,
    tag,
    generalNotes: student.notes_private ?? undefined,
    photoUrl,
    photoPosition,
    avatarBg: '#D8F3DC',
    avatarFg: '#245C3F',
    annotationCount: 0,
    development: {
      linguagem: 0,
      socializacao: 0,
      coordenacao: 0,
      autonomia: 0,
    },
    timeline: [],
  }
}

async function uploadChildPhoto(ownerId: string, studentId: string, file: File) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${ownerId}/${studentId}/profile-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from('child-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw toError(error, 'Nao foi possivel enviar a foto privada da crianca.')
  return path
}

async function getSignedChildPhotoUrl(path: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.storage.from('child-photos').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

function isMissingPhotoPositionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const text = JSON.stringify(error).toLowerCase()
  return text.includes('photo_position')
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

function calculateAgeParts(birthDate: string) {
  if (!birthDate) return { years: 0, months: 0 }
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()

  if (today.getDate() < birth.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  return { years: Math.max(0, Math.min(5, years)), months: Math.max(0, months) }
}
