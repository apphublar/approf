import { Bell, Mail, Send } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { formatRelativeDate } from '../lib/admin-utils'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type NotificationEvent = {
  id: string
  type: string
  channel: string
  status: string
  created_at: string
  recipient: { full_name: string; email: string } | null
}

const channelLabels: Record<string, string> = {
  email: 'E-mail',
  telegram: 'Telegram',
  system: 'Sistema',
}

const statusLabels: Record<string, string> = {
  queued: 'Na fila',
  sent: 'Enviada',
  failed: 'Falha',
}

export default async function NotificationsPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('notification_events')
    .select('id, type, channel, status, created_at, recipient:profiles!user_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  const events = (data ?? []) as unknown as NotificationEvent[]

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Sistema"
        title="Notificacoes"
        badge={<span className="readonly-badge">somente leitura</span>}
        description="Fila de e-mail, Telegram e sistema. Util para confirmar se um aviso chegou."
      />

      <article className="notif-list-v2">
        {events.length === 0 ? (
          <div className="empty-state-v2"><p>Nenhuma notificacao registrada.</p></div>
        ) : (
          events.map((event) => {
            const Icon = event.channel === 'email' ? Mail : event.channel === 'telegram' ? Send : Bell
            return (
              <div key={event.id} className="notif-item-v2">
                <span className="teacher-avatar"><Icon size={16} /></span>
                <div style={{ flex: 1 }}>
                  <strong>{event.type.replaceAll('_', ' ')}</strong>
                  <small>{channelLabels[event.channel] ?? event.channel} · {formatRelativeDate(event.created_at)}</small>
                </div>
                <span className={`status-chip status-chip-${event.status === 'sent' ? 'sent' : event.status === 'failed' ? 'blocked' : 'queued'}`}>
                  {statusLabels[event.status] ?? event.status}
                </span>
              </div>
            )
          })
        )}
      </article>
    </div>
  )
}
