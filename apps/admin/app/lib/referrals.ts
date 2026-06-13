import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export async function tryGrantReferralReward(referredUserId: string) {
  if (!referredUserId) return null
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('grant_teacher_referral_reward', {
    p_referred_user_id: referredUserId,
  })
  if (error) {
    console.error('[referrals/grant]', referredUserId, error)
    return null
  }
  return data as {
    granted?: boolean
    reason?: string
    credit_cents?: number
    giztokens_bonus?: number
  } | null
}

export async function getTeacherReferralSummary(ownerId: string) {
  const supabase = createSupabaseServiceClient()

  const [profileResult, referralsResult, creditsResult] = await Promise.all([
    supabase.from('profiles').select('teacher_code, full_name').eq('id', ownerId).maybeSingle(),
    supabase
      .from('teacher_referrals')
      .select('id, referred_id, status, credit_cents, giztokens_bonus, created_at, converted_at, rewarded_at, referred_plan')
      .eq('referrer_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('referral_credits')
      .select('amount_cents, consumed_cents, expires_at')
      .eq('owner_id', ownerId),
  ])

  if (profileResult.error) throw profileResult.error
  if (referralsResult.error) throw referralsResult.error
  if (creditsResult.error) throw creditsResult.error

  const referrals = referralsResult.data ?? []
  const referredIds = Array.from(new Set(referrals.map((item) => item.referred_id).filter(Boolean)))
  const { data: referredProfiles, error: referredProfilesError } = referredIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', referredIds)
    : { data: [], error: null }
  if (referredProfilesError) throw referredProfilesError

  const referredNameById = new Map((referredProfiles ?? []).map((profile) => [profile.id, profile.full_name?.trim() || 'Professora indicada']))
  const now = Date.now()

  const availableCreditCents = (creditsResult.data ?? []).reduce((total, credit) => {
    const expiresAt = credit.expires_at ? new Date(credit.expires_at).getTime() : 0
    if (expiresAt <= now) return total
    return total + Math.max(0, (credit.amount_cents ?? 0) - (credit.consumed_cents ?? 0))
  }, 0)

  const totalGiztokensEarned = referrals.reduce((total, item) => total + (item.giztokens_bonus ?? 0), 0)

  return {
    teacherCode: profileResult.data?.teacher_code?.trim() || null,
    stats: {
      registered: referrals.filter((item) => item.status === 'registered').length,
      converted: referrals.filter((item) => ['converted', 'rewarded'].includes(item.status)).length,
      rewarded: referrals.filter((item) => item.status === 'rewarded').length,
    },
    availableCreditCents,
    totalGiztokensEarned,
    history: referrals.map((item) => ({
      id: item.id,
      referredName: referredNameById.get(item.referred_id) || 'Professora indicada',
      status: item.status,
      referredPlan: item.referred_plan,
      creditCents: item.credit_cents ?? 0,
      giztokensBonus: item.giztokens_bonus ?? 0,
      createdAt: item.created_at,
      convertedAt: item.converted_at,
      rewardedAt: item.rewarded_at,
    })),
  }
}
