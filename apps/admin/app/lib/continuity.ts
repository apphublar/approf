import { createSupabaseServiceClient } from './supabase-server'

export type ContinuityRequestType = 'link' | 'transfer_teacher' | 'transfer_class'
export type ContinuityRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled'

export interface ChildSearchPreviewResult {
  id: string
  childCode: string
  name: string
  birthDate: string
  school: string
  previousClass: string
  lastTeacher: string
  recordsCount: number
  timelineSummary: string[]
  ownerId: string
  isExternal: boolean
}

export interface ContinuityRequestRow {
  id: string
  requestType: ContinuityRequestType
  status: ContinuityRequestStatus
  requesterId: string
  studentId: string
  fromOwnerId: string
  targetOwnerId: string | null
  targetClassId: string | null
  targetTeacherCode: string | null
  reason: string | null
  createdAt: string
  studentName?: string
  requesterName?: string
}

function buildChildCode(studentId: string) {
  return `CRI-${studentId.slice(0, 8).toUpperCase()}`
}

function parseChildCode(childCode: string) {
  const normalized = childCode.trim().toUpperCase()
  const match = normalized.match(/^CRI-([0-9A-F]{8})$/)
  return match?.[1]?.toLowerCase() ?? null
}

export async function searchChildPreviews(input: {
  requesterId: string
  childCode?: string
  name?: string
  birthDate?: string
  limit?: number
}): Promise<ChildSearchPreviewResult[]> {
  const supabase = createSupabaseServiceClient()
  const limit = input.limit ?? 20
  let query = supabase
    .from('students')
    .select('id, owner_id, full_name, birth_date, class_id')
    .is('archived_at', null)
    .neq('owner_id', input.requesterId)
    .limit(limit)

  const codePrefix = input.childCode ? parseChildCode(input.childCode) : null
  if (codePrefix) {
    query = query.ilike('id', `${codePrefix}%`)
  } else if (input.name && input.name.trim().length >= 2) {
    query = query.ilike('full_name', `%${input.name.trim()}%`)
    if (input.birthDate) query = query.eq('birth_date', input.birthDate)
  } else {
    return []
  }

  const { data, error } = await query
  if (error) throw error

  const studentIds = (data ?? []).map((row) => row.id as string)
  const classIds = Array.from(new Set((data ?? []).map((row) => String(row.class_id)).filter(Boolean)))
  const ownerIds = Array.from(new Set((data ?? []).map((row) => String(row.owner_id)).filter(Boolean)))

  const [timelineResult, annotationResult, reportResult, classesResult, profilesResult] = await Promise.all([
    studentIds.length
      ? supabase.from('student_timeline_events').select('student_id, title, event_type').in('student_id', studentIds).order('occurred_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from('annotation_targets').select('target_id').eq('target_type', 'student').in('target_id', studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from('reports').select('student_id').in('student_id', studentIds).neq('status', 'failed')
      : Promise.resolve({ data: [], error: null }),
    classIds.length
      ? supabase.from('classes').select('id, name, school_id').in('id', classIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const schoolIds = Array.from(new Set((classesResult.data ?? []).map((row) => String(row.school_id)).filter(Boolean)))
  const schoolsResult = schoolIds.length
    ? await supabase.from('schools').select('id, name').in('id', schoolIds)
    : { data: [], error: null }

  const timelineByStudent = new Map<string, string[]>()
  ;(timelineResult.data ?? []).forEach((row) => {
    const studentId = String(row.student_id)
    const current = timelineByStudent.get(studentId) ?? []
    if (current.length < 3 && row.title) current.push(String(row.title))
    timelineByStudent.set(studentId, current)
  })

  const noteCountByStudent = new Map<string, number>()
  ;(annotationResult.data ?? []).forEach((row) => {
    const studentId = String(row.target_id)
    noteCountByStudent.set(studentId, (noteCountByStudent.get(studentId) ?? 0) + 1)
  })

  const reportCountByStudent = new Map<string, number>()
  ;(reportResult.data ?? []).forEach((row) => {
    const studentId = String(row.student_id)
    reportCountByStudent.set(studentId, (reportCountByStudent.get(studentId) ?? 0) + 1)
  })

  const classById = new Map((classesResult.data ?? []).map((row) => [String(row.id), row]))
  const schoolById = new Map((schoolsResult.data ?? []).map((row) => [String(row.id), row]))
  const profileById = new Map((profilesResult.data ?? []).map((row) => [String(row.id), row]))
  const milestoneCountByStudent = new Map<string, number>()
  ;(timelineResult.data ?? []).forEach((row) => {
    const studentId = String(row.student_id)
    const isMilestone = row.event_type === 'marco' || String(row.title ?? '').toLowerCase().includes('marco')
    if (!isMilestone) return
    milestoneCountByStudent.set(studentId, (milestoneCountByStudent.get(studentId) ?? 0) + 1)
  })

  return (data ?? []).map((row) => {
    const studentId = String(row.id)
    const classData = classById.get(String(row.class_id))
    const schoolData = classData?.school_id ? schoolById.get(String(classData.school_id)) : null
    const ownerProfile = profileById.get(String(row.owner_id))

    return {
      id: studentId,
      childCode: buildChildCode(studentId),
      name: String(row.full_name ?? 'Criança'),
      birthDate: row.birth_date ? String(row.birth_date) : '',
      school: schoolData?.name ? String(schoolData.name) : 'Escola não informada',
      previousClass: classData?.name ? String(classData.name) : 'Turma',
      lastTeacher: ownerProfile?.full_name ? String(ownerProfile.full_name) : 'Professora',
      recordsCount:
        (noteCountByStudent.get(studentId) ?? 0)
        + (milestoneCountByStudent.get(studentId) ?? 0)
        + (reportCountByStudent.get(studentId) ?? 0),
      timelineSummary: timelineByStudent.get(studentId) ?? [],
      ownerId: String(row.owner_id),
      isExternal: true,
    }
  })
}

export async function createContinuityRequest(input: {
  requesterId: string
  requestType: ContinuityRequestType
  studentId: string
  targetClassId?: string | null
  targetTeacherCode?: string | null
  reason?: string | null
}) {
  const supabase = createSupabaseServiceClient()
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, owner_id, class_id')
    .eq('id', input.studentId)
    .maybeSingle()
  if (studentError) throw studentError
  if (!student) throw new Error('Criança não encontrada.')

  let targetOwnerId: string | null = null
  if (input.requestType === 'transfer_teacher' && input.targetTeacherCode?.trim()) {
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('teacher_code', input.targetTeacherCode.trim().toUpperCase())
      .maybeSingle()
    if (profileError) throw profileError
    if (!targetProfile) throw new Error('Código de professora não encontrado.')
    targetOwnerId = targetProfile.id
  }

  if (input.requestType === 'transfer_class' && student.owner_id === input.requesterId) {
    if (!input.targetClassId) throw new Error('Informe a turma de destino.')
    const { data: targetClass, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', input.targetClassId)
      .eq('owner_id', input.requesterId)
      .maybeSingle()
    if (classError) throw classError
    if (!targetClass) throw new Error('Turma de destino inválida.')

    const { error: moveError } = await supabase
      .from('students')
      .update({ class_id: input.targetClassId, updated_at: new Date().toISOString() })
      .eq('id', input.studentId)
      .eq('owner_id', input.requesterId)
    if (moveError) throw moveError

    const { data: request, error: requestError } = await supabase
      .from('student_continuity_requests')
      .insert({
        request_type: 'transfer_class',
        status: 'approved',
        requester_id: input.requesterId,
        student_id: input.studentId,
        from_owner_id: student.owner_id,
        target_owner_id: input.requesterId,
        target_class_id: input.targetClassId,
        reason: input.reason ?? null,
        reviewed_by: input.requesterId,
        reviewed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (requestError) throw requestError
    return { requestId: request.id, immediate: true as const }
  }

  const { data: request, error } = await supabase
    .from('student_continuity_requests')
    .insert({
      request_type: input.requestType,
      status: 'pending',
      requester_id: input.requesterId,
      student_id: input.studentId,
      from_owner_id: student.owner_id,
      target_owner_id: targetOwnerId,
      target_class_id: input.targetClassId ?? null,
      target_teacher_code: input.targetTeacherCode?.trim().toUpperCase() ?? null,
      reason: input.reason ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  await supabase.from('admin_action_logs').insert({
    actor_id: input.requesterId,
    action: 'continuity_request_created',
    target_table: 'student_continuity_requests',
    target_id: request.id,
    metadata: {
      requestType: input.requestType,
      studentId: input.studentId,
      fromOwnerId: student.owner_id,
    },
  })

  return { requestId: request.id, immediate: false as const }
}

export async function listContinuityRequestsForAdmin() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('student_continuity_requests')
    .select('id, request_type, status, requester_id, student_id, from_owner_id, target_owner_id, target_class_id, target_teacher_code, reason, created_at, students(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  const requesterIds = Array.from(new Set((data ?? []).map((row) => String(row.requester_id))))
  const { data: requesters } = requesterIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', requesterIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> }
  const requesterById = new Map((requesters ?? []).map((row) => [String(row.id), row.full_name]))

  return (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    return {
      id: String(row.id),
      requestType: row.request_type as ContinuityRequestType,
      status: row.status as ContinuityRequestStatus,
      requesterId: String(row.requester_id),
      studentId: String(row.student_id),
      fromOwnerId: String(row.from_owner_id),
      targetOwnerId: row.target_owner_id ? String(row.target_owner_id) : null,
      targetClassId: row.target_class_id ? String(row.target_class_id) : null,
      targetTeacherCode: row.target_teacher_code ? String(row.target_teacher_code) : null,
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at),
      studentName: student?.full_name ? String(student.full_name) : undefined,
      requesterName: requesterById.get(String(row.requester_id)) ?? undefined,
    }
  }) satisfies ContinuityRequestRow[]
}

export async function updateContinuityRequestStatus(input: {
  requestId: string
  status: ContinuityRequestStatus
  reviewerId: string
  reviewNotes?: string | null
  targetClassId?: string | null
}) {
  const supabase = createSupabaseServiceClient()
  const { data: request, error: requestError } = await supabase
    .from('student_continuity_requests')
    .select('id, request_type, status, requester_id, student_id, from_owner_id, target_owner_id, target_class_id')
    .eq('id', input.requestId)
    .maybeSingle()
  if (requestError) throw requestError
  if (!request) throw new Error('Solicitação não encontrada.')
  if (request.status !== 'pending') throw new Error('Esta solicitação já foi revisada.')

  if (input.status === 'approved') {
    const destinationClassId = input.targetClassId ?? request.target_class_id
    const destinationOwnerId = request.request_type === 'link'
      ? request.requester_id
      : (request.target_owner_id ?? request.requester_id)

    if (!destinationClassId) {
      throw new Error('Informe a turma de destino para aprovar a solicitação.')
    }

    const { data: destinationClass, error: classError } = await supabase
      .from('classes')
      .select('id, owner_id')
      .eq('id', destinationClassId)
      .maybeSingle()
    if (classError) throw classError
    if (!destinationClass || destinationClass.owner_id !== destinationOwnerId) {
      throw new Error('Turma de destino inválida para esta solicitação.')
    }

    const { error: moveError } = await supabase
      .from('students')
      .update({
        owner_id: destinationOwnerId,
        class_id: destinationClassId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.student_id)
    if (moveError) throw moveError
  }

  const { error: updateError } = await supabase
    .from('student_continuity_requests')
    .update({
      status: input.status,
      reviewed_by: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes ?? null,
      target_class_id: input.targetClassId ?? request.target_class_id,
    })
    .eq('id', input.requestId)
  if (updateError) throw updateError

  await supabase.from('admin_action_logs').insert({
    actor_id: input.reviewerId,
    action: 'continuity_request_reviewed',
    target_table: 'student_continuity_requests',
    target_id: input.requestId,
    metadata: { status: input.status, reviewNotes: input.reviewNotes ?? null },
  })
}
