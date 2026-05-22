import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

type VerificationDocumentPayload = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

type VerificationStatus = 'pending' | 'approved' | 'rejected'

export async function getTeacherAccountData(ownerId: string) {
  const supabase = createSupabaseServiceClient()

  const [profileResult, schoolsResult, subscriptionResult, verificationsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,full_name,email,phone')
      .eq('id', ownerId)
      .maybeSingle(),
    supabase
      .from('schools')
      .select('id,name,city,state')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('id,status,plan,provider,current_period_end,trial_expires_at,updated_at,notes')
      .eq('user_id', ownerId)
      .maybeSingle(),
    supabase
      .from('teacher_profile_verifications')
      .select('id,status,school_ids,documents,notes,created_at,updated_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (profileResult.error) throw profileResult.error
  if (schoolsResult.error) throw schoolsResult.error
  if (subscriptionResult.error) throw subscriptionResult.error
  if (verificationsResult.error) throw verificationsResult.error

  return {
    profile: profileResult.data,
    schools: schoolsResult.data ?? [],
    subscription: subscriptionResult.data,
    verifications: (verificationsResult.data ?? []).map((item) => ({
      ...item,
      documents: Array.isArray(item.documents) ? item.documents : [],
    })),
  }
}

export async function updateTeacherProfile(ownerId: string, input: { fullName?: string; phone?: string | null }) {
  const supabase = createSupabaseServiceClient()
  const patch = {
    ...(typeof input.fullName === 'string' ? { full_name: input.fullName.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', ownerId)
  if (error) throw error
}

export async function cancelTeacherSubscription(ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { data: current, error: selectError } = await supabase
    .from('subscriptions')
    .select('id,notes')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (selectError) throw selectError
  if (!current) {
    const { error: insertError } = await supabase.from('subscriptions').insert({
      user_id: ownerId,
      status: 'canceled',
      plan: 'manual',
      provider: 'manual',
      notes: `[${new Date().toISOString()}] cancelada pela professora no app`,
    })
    if (insertError) throw insertError
    return
  }

  const nextNotes = [current.notes, `[${new Date().toISOString()}] cancelada pela professora no app`]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000)

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled' satisfies SubscriptionStatus,
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
  if (error) throw error
}

export async function createTeacherVerificationRequest(
  ownerId: string,
  input: { schoolIds: string[]; notes?: string; documents: VerificationDocumentPayload[] },
) {
  const supabase = createSupabaseServiceClient()
  const safeDocs = input.documents
    .filter((doc) => typeof doc.path === 'string' && doc.path.startsWith(`${ownerId}/`))
    .map((doc) => ({
      path: doc.path,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      size: doc.size,
    }))

  if (!safeDocs.length) throw new Error('Anexe ao menos um documento válido para verificação.')

  const { data, error } = await supabase
    .from('teacher_profile_verifications')
    .insert({
      owner_id: ownerId,
      school_ids: input.schoolIds,
      notes: input.notes?.trim() || null,
      status: 'pending',
      documents: safeDocs,
    })
    .select('id,status,school_ids,documents,notes,created_at,updated_at')
    .single()

  if (error) throw error
  return {
    ...data,
    documents: Array.isArray(data.documents) ? data.documents : [],
  }
}

export async function listTeacherVerificationRequests() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('teacher_profile_verifications')
    .select('id,owner_id,school_ids,status,notes,documents,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  const requests = data ?? []
  const ownerIds = Array.from(new Set(requests.map((item) => item.owner_id).filter(Boolean)))
  const schoolIds = Array.from(
    new Set(
      requests.flatMap((item) =>
        Array.isArray(item.school_ids) ? item.school_ids.filter((id): id is string => typeof id === 'string') : [],
      ),
    ),
  )

  const [profilesResult, schoolsResult] = await Promise.all([
    ownerIds.length
      ? supabase.from('profiles').select('id,full_name,email,phone').in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    schoolIds.length
      ? supabase.from('schools').select('id,name,city,state').in('id', schoolIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (schoolsResult.error) throw schoolsResult.error

  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const schoolById = new Map((schoolsResult.data ?? []).map((school) => [school.id, school]))

  return Promise.all(
    requests.map(async (request) => {
      const rawDocuments = Array.isArray(request.documents) ? request.documents : []
      const documents = await Promise.all(
        rawDocuments.map(async (doc) => {
          const safeDoc = normalizeDocument(doc)
          if (!safeDoc) return null
          const signedUrl = await createVerificationSignedUrl(safeDoc.path)
          return {
            ...safeDoc,
            signedUrl,
          }
        }),
      )

      return {
        id: request.id,
        ownerId: request.owner_id,
        status: request.status as VerificationStatus,
        notes: request.notes,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        teacher: profileById.get(request.owner_id) ?? null,
        schools: (Array.isArray(request.school_ids) ? request.school_ids : [])
          .map((schoolId) => schoolById.get(schoolId))
          .filter(Boolean),
        documents: documents.filter(Boolean),
      }
    }),
  )
}

export async function updateTeacherVerificationStatus(input: {
  verificationId: string
  status: VerificationStatus
  reviewNotes?: string
}) {
  const supabase = createSupabaseServiceClient()
  const patch = {
    status: input.status,
    notes: input.reviewNotes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('teacher_profile_verifications')
    .update(patch)
    .eq('id', input.verificationId)
  if (error) throw error
}

function normalizeDocument(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<VerificationDocumentPayload>
  if (!record.path || !record.fileName) return null
  return {
    path: record.path,
    fileName: record.fileName,
    mimeType: record.mimeType ?? 'application/octet-stream',
    size: typeof record.size === 'number' ? record.size : 0,
  }
}

async function createVerificationSignedUrl(path: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage.from('profile-verification').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
