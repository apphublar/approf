import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

type VerificationDocumentPayload = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

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
