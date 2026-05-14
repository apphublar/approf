import type { ClassData, Student } from '@/types'
import { toTitleCaseName } from '@/utils/text'
import { getSupabaseClient } from './client'
import { mapSupabaseStudent } from './students'
import { loadSupabaseTimelineEvents } from './timeline'
import { loadSupabaseAnnotations } from './annotations'
import { loadSupabaseAttendanceRecords } from './attendance'

export interface ClassInput {
  name: string
  school: string
  shift: string
  ageGroup: string
  notes?: string
}

export async function loadTeacherWorkspace() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const user = userData.user
  if (!user) throw new Error('Sessao nao encontrada.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError

  const [schoolsResult, classesResult, studentsResult, timelineEvents, attendanceRecords] = await Promise.all([
    supabase.from('schools').select('id, name').eq('owner_id', user.id),
    supabase
      .from('classes')
      .select('id, school_id, name, shift, age_group')
      .eq('owner_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    loadStudentsWithPhotoPositionFallback(user.id),
    loadSupabaseTimelineEvents(user.id),
    loadSupabaseAttendanceRecords(user.id),
  ])

  if (schoolsResult.error) throw schoolsResult.error
  if (classesResult.error) throw classesResult.error
  if (studentsResult.error) throw studentsResult.error

  const schoolById = new Map((schoolsResult.data ?? []).map((school) => [school.id, school.name]))
  const timelineByStudentId = new Map<string, Student['timeline']>()
  timelineEvents.forEach(({ studentId, event }) => {
    const current = timelineByStudentId.get(studentId) ?? []
    current.push(event)
    timelineByStudentId.set(studentId, current)
  })
  const studentsByClassId = new Map<string, Student[]>()
  const mappedStudents = await Promise.all(
    (studentsResult.data ?? []).map(async (student) => ({
      classId: student.class_id,
      student: {
        ...(await mapSupabaseStudent(student)),
        annotationCount: timelineByStudentId.get(student.id)?.length ?? 0,
        timeline: timelineByStudentId.get(student.id) ?? [],
      },
    })),
  )
  mappedStudents.forEach(({ classId, student }) => {
    const current = studentsByClassId.get(classId) ?? []
    current.push(student)
    studentsByClassId.set(classId, current)
  })

  const classes = (classesResult.data ?? []).map((item): ClassData => ({
    id: item.id,
    name: item.name,
    shift: item.shift ?? 'Manha',
    school: item.school_id ? schoolById.get(item.school_id) ?? 'Escola nao informada' : 'Escola nao informada',
    ageGroup: item.age_group ?? 'Educacao infantil',
    iconBg: '#D8F3DC',
    students: studentsByClassId.get(item.id) ?? [],
  }))
  const annotations = await loadSupabaseAnnotations(user.id, classes)

  return {
    userId: user.id,
    userName: toTitleCaseName(profile.full_name),
    schoolName: schoolsResult.data?.[0]?.name ?? 'Escola nao informada',
    classes,
    annotations,
    attendanceRecords,
  }
}

async function loadStudentsWithPhotoPositionFallback(ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const query = supabase
    .from('students')
    .select('id, class_id, full_name, birth_date, photo_path, photo_position, notes_private, support_tags')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  const result = await query
  if (!isMissingPhotoPositionError(result.error)) return result

  return supabase
    .from('students')
    .select('id, class_id, full_name, birth_date, photo_path, notes_private, support_tags')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
}

export async function createSupabaseClass(input: ClassInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const schoolId = await ensureSchool(input.school, ownerId)
  const { data, error } = await supabase
    .from('classes')
    .insert({
      owner_id: ownerId,
      school_id: schoolId,
      name: input.name,
      shift: input.shift,
      age_group: input.ageGroup,
    })
    .select('id, name, shift, age_group')
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    shift: data.shift ?? input.shift,
    school: input.school,
    ageGroup: data.age_group ?? input.ageGroup,
    notes: input.notes,
    iconBg: '#D8F3DC',
    students: [],
  } satisfies ClassData
}

export async function updateSupabaseClass(classId: string, input: ClassInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessao nao encontrada.')

  const schoolId = await ensureSchool(input.school, ownerId)
  const { error } = await supabase
    .from('classes')
    .update({
      school_id: schoolId,
      name: input.name,
      shift: input.shift,
      age_group: input.ageGroup,
    })
    .eq('id', classId)
    .eq('owner_id', ownerId)

  if (error) throw error
}

async function ensureSchool(name: string, ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const normalizedName = name.trim()
  const { data: existing, error: selectError } = await supabase
    .from('schools')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('name', normalizedName)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing.id

  const { data: created, error: insertError } = await supabase
    .from('schools')
    .insert({ owner_id: ownerId, name: normalizedName })
    .select('id')
    .single()

  if (insertError) throw insertError
  return created.id
}

function isMissingPhotoPositionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  return JSON.stringify(error).toLowerCase().includes('photo_position')
}
