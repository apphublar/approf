import type { ClassData, Student } from '@/types'
import { toTitleCaseName } from '@/utils/text'
import { getSupabaseClient } from './client'
import { mapSupabaseStudent } from './students'
import { loadSupabaseTimelineEvents } from './timeline'
import { loadSupabaseAnnotations } from './annotations'
import { loadSupabaseAttendanceRecords } from './attendance'
import { loadBoardNotes } from './board-notes'
import { loadCommunityFeatureAccess, loadCommunityPosts } from './community'
import { loadInterventionRecords } from './interventions'

export interface ClassInput {
  name: string
  school: string
  shift: string
  ageGroup: string
  notes?: string
}

export async function loadTeacherWorkspace() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const user = userData.user
  if (!user) throw new Error('Sessão não encontrada.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, estimated_student_count, teacher_code')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError

  const [schoolsResult, classesResult, studentsResult, timelineEvents, attendanceRecords, boardNotes] = await Promise.all([
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
    loadBoardNotes(user.id),
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
    ageGroup: item.age_group ?? 'Educação infantil',
    iconBg: '#D8F3DC',
    students: studentsByClassId.get(item.id) ?? [],
  }))
  const [{ annotations, hasMore: annotationsHasMore }, communityAccess, communityPosts, interventions] = await Promise.all([
    loadSupabaseAnnotations(user.id, classes),
    loadCommunityFeatureAccess(user.id),
    loadCommunityPosts().catch(() => []),
    loadInterventionRecords(user.id).catch(() => []),
  ])
  const noteCountByStudentId = buildNoteCountByStudentId(classes, annotations)
  const classesWithCounts = classes.map((classData) => ({
    ...classData,
    students: classData.students.map((student) => ({
      ...student,
      annotationCount: noteCountByStudentId.get(student.id) ?? 0,
    })),
  }))

  return {
    userId: user.id,
    userName: toTitleCaseName(profile.full_name),
    schoolName: schoolsResult.data?.[0]?.name ?? 'Escola nao informada',
    classes: classesWithCounts,
    annotations,
    annotationsHasMore,
    attendanceRecords,
    boardNotes,
    communityAccess,
    communityPosts,
    interventions,
    teacherCode: profile.teacher_code ?? '',
    onboardingCompleted: Number(profile.estimated_student_count ?? 0) > 0 || classes.length > 0,
  }
}

async function loadStudentsWithPhotoPositionFallback(ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const query = supabase
    .from('students')
    .select('id, class_id, full_name, birth_date, photo_path, photo_position, notes_private, support_tags, created_at')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  const result = await query
  if (!isMissingPhotoPositionError(result.error)) return result

  return supabase
    .from('students')
    .select('id, class_id, full_name, birth_date, photo_path, notes_private, support_tags, created_at')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
}

export async function createSupabaseClass(input: ClassInput) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const schoolId = await ensureTeacherSchool(input.school, ownerId)
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
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sessão não encontrada.')

  const schoolId = await ensureTeacherSchool(input.school, ownerId)
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

export async function ensureTeacherSchool(name: string, ownerId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

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

function buildNoteCountByStudentId(classes: ClassData[], annotations: Array<{ studentId?: string | null; studentName?: string | null }>) {
  const nameByStudentId = new Map<string, string>()
  classes.forEach((classData) => {
    classData.students.forEach((student) => {
      nameByStudentId.set(student.id, normalizeText(student.name))
    })
  })

  const countByStudentId = new Map<string, number>()
  annotations.forEach((annotation) => {
    if (annotation.studentId && nameByStudentId.has(annotation.studentId)) {
      countByStudentId.set(annotation.studentId, (countByStudentId.get(annotation.studentId) ?? 0) + 1)
      return
    }

    const normalizedAnnotationName = normalizeText(annotation.studentName ?? '')
    if (!normalizedAnnotationName) return
    for (const [studentId, normalizedStudentName] of nameByStudentId.entries()) {
      if (normalizedStudentName === normalizedAnnotationName) {
        countByStudentId.set(studentId, (countByStudentId.get(studentId) ?? 0) + 1)
        break
      }
    }
  })

  return countByStudentId
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
