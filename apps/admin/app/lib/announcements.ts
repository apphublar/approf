import { createSupabaseServiceClient } from './supabase-server'
import type { AnnouncementAudience, AnnouncementType } from './announcement-types'

export type { AnnouncementAudience, AnnouncementType } from './announcement-types'
export { ANNOUNCEMENT_TYPES, AUDIENCE_LABELS } from './announcement-types'

type TeacherAudienceRow = {
  id: string
  subscriptions?: Array<{ status: string; plan: string; current_period_end: string | null }>
  teacher_profile_verifications?: Array<{ status: string }>
}

export async function resolveAnnouncementAudience(audience: AnnouncementAudience) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, subscriptions(status, plan, current_period_end), teacher_profile_verifications(status)')
    .eq('role', 'teacher')

  if (error) throw new Error(error.message)
  const teachers = (data ?? []) as TeacherAudienceRow[]

  if (audience === 'todas') return teachers.map((t) => t.id)

  return teachers
    .filter((teacher) => {
      const subscription = teacher.subscriptions?.[0]
      const verification = latestVerification(teacher.teacher_profile_verifications ?? [])
      if (audience === 'pagando') {
        return subscription?.status === 'active' && ['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(subscription.plan)
      }
      if (audience === 'trial') return subscription?.status === 'trial'
      if (audience === 'atraso') return isOverdue(subscription)
      if (audience === 'verificadas') return verification?.status === 'approved'
      return false
    })
    .map((t) => t.id)
}

export async function sendAppAnnouncement(input: {
  type: AnnouncementType
  title: string
  body: string
  audience: AnnouncementAudience
  ctaLabel?: string
  ctaUrl?: string
  pinned: boolean
  createdBy: string
}) {
  const title = input.title.trim()
  const body = input.body.trim().slice(0, 240)
  if (!title) throw new Error('Informe um título.')
  if (!body) throw new Error('Informe a mensagem.')

  const recipientIds = await resolveAnnouncementAudience(input.audience)
  if (!recipientIds.length) throw new Error('Nenhuma professora corresponde ao público selecionado.')

  const supabase = createSupabaseServiceClient()
  const { data: announcement, error } = await supabase
    .from('app_announcements')
    .insert({
      type: input.type,
      title,
      body,
      audience: input.audience,
      cta_label: input.ctaLabel?.trim() || null,
      cta_url: input.ctaUrl?.trim() || null,
      pinned: input.pinned,
      created_by: input.createdBy,
    })
    .select('id, type, title, audience, created_at')
    .single()

  if (error) throw new Error(error.message)

  const deliveries = recipientIds.map((userId) => ({
    announcement_id: announcement.id,
    user_id: userId,
  }))

  const batchSize = 500
  for (let i = 0; i < deliveries.length; i += batchSize) {
    const chunk = deliveries.slice(i, i + batchSize)
    const { error: deliveryError } = await supabase.from('app_announcement_deliveries').insert(chunk)
    if (deliveryError) throw new Error(deliveryError.message)
  }

  return {
    announcement,
    recipientCount: recipientIds.length,
  }
}

export async function listSentAnnouncements(limit = 50) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('app_announcements')
    .select('id, type, title, audience, created_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const announcements = data ?? []
  if (!announcements.length) return []

  const ids = announcements.map((item) => item.id)
  const { data: counts, error: countError } = await supabase
    .from('app_announcement_deliveries')
    .select('announcement_id')
    .in('announcement_id', ids)

  if (countError) throw new Error(countError.message)

  const countByAnnouncement = new Map<string, number>()
  for (const row of counts ?? []) {
    countByAnnouncement.set(row.announcement_id, (countByAnnouncement.get(row.announcement_id) ?? 0) + 1)
  }

  const now = Date.now()
  return announcements.map((item) => ({
    ...item,
    recipientCount: countByAnnouncement.get(item.id) ?? 0,
    active: !item.expires_at || new Date(item.expires_at).getTime() > now,
  }))
}

export function isAnnouncementActive(expiresAt: string | null | undefined) {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}

export async function deactivateAppAnnouncement(announcementId: string) {
  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('app_announcements')
    .update({ expires_at: now })
    .eq('id', announcementId)
  if (error) throw new Error(error.message)

  await supabase
    .from('app_announcement_deliveries')
    .update({ dismissed_at: now })
    .eq('announcement_id', announcementId)
    .is('dismissed_at', null)
}

export async function deleteAppAnnouncement(announcementId: string) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('app_announcements').delete().eq('id', announcementId)
  if (error) throw new Error(error.message)
}

export async function loadActiveAnnouncementsForUser(userId: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('app_announcement_deliveries')
    .select(`
      id,
      dismissed_at,
      announcement:app_announcements (
        id,
        type,
        title,
        body,
        cta_label,
        cta_url,
        pinned,
        created_at,
        expires_at
      )
    `)
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  const now = Date.now()
  return (data ?? [])
    .map((row) => {
      const announcement = Array.isArray(row.announcement) ? row.announcement[0] : row.announcement
      if (!announcement) return null
      if (announcement.expires_at && new Date(announcement.expires_at).getTime() < now) return null
      return {
        deliveryId: row.id,
        id: announcement.id,
        type: announcement.type as AnnouncementType,
        title: announcement.title,
        message: announcement.body,
        ctaLabel: announcement.cta_label,
        ctaUrl: announcement.cta_url,
        pinned: announcement.pinned,
        createdAt: announcement.created_at,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export async function dismissAnnouncementDelivery(userId: string, deliveryId: string) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('app_announcement_deliveries')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

function latestVerification(items: Array<{ status: string }>) {
  return items[0] ?? null
}

function isOverdue(subscription?: { status: string; plan: string; current_period_end: string | null }) {
  if (!subscription) return false
  if (subscription.status === 'overdue') return true
  if (!['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(subscription.plan)) return false
  if (!subscription.current_period_end) return false
  return new Date(subscription.current_period_end).getTime() < Date.now()
}
