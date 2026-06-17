'use server'

import { requireAdminSession } from '../lib/admin-auth'
import { sendAppAnnouncement, type AnnouncementAudience, type AnnouncementType } from '../lib/announcements'
import { redirectWithToast } from '../lib/redirect-with-toast'
import { createSupabaseServiceClient } from '../lib/supabase-server'

const TYPES: AnnouncementType[] = ['novidade', 'info', 'alerta', 'manutencao']
const AUDIENCES: AnnouncementAudience[] = ['todas', 'pagando', 'trial', 'atraso', 'verificadas']

export async function sendAnnouncementAction(formData: FormData) {
  const admin = await requireAdminSession()
  const type = String(formData.get('type') ?? 'novidade') as AnnouncementType
  const audience = String(formData.get('audience') ?? 'todas') as AnnouncementAudience
  const title = String(formData.get('title') ?? '')
  const body = String(formData.get('body') ?? '')
  const ctaLabel = String(formData.get('ctaLabel') ?? '')
  const ctaUrl = String(formData.get('ctaUrl') ?? '')
  const pinned = formData.get('pinned') === 'on'

  if (!TYPES.includes(type)) throw new Error('Tipo de aviso invalido.')
  if (!AUDIENCES.includes(audience)) throw new Error('Publico invalido.')

  const result = await sendAppAnnouncement({
    type,
    title,
    body,
    audience,
    ctaLabel,
    ctaUrl,
    pinned,
    createdBy: admin.userId,
  })

  const supabase = createSupabaseServiceClient()
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'app_announcement_sent',
    target_table: 'app_announcements',
    target_id: result.announcement.id,
    metadata: {
      title: result.announcement.title,
      audience,
      recipientCount: result.recipientCount,
    },
  })

  redirectWithToast('/avisos', `Aviso enviado para ${result.recipientCount} professora(s) no app.`)
}
