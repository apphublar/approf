import { Bell } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
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

export default async function NotificationsPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('notification_events')
    .select('id, type, channel, status, created_at, recipient:profiles!user_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  const events = (data ?? []) as unknown as NotificationEvent[]

  const byStatus = {
    queued: events.filter((e) => e.status === 'queued').length,
    sent: events.filter((e) => e.status === 'sent').length,
    failed: events.filter((e) => e.status === 'failed').length,
  }

  return (
    <>
      <PageHeader
        eyebrow="Notificações"
        title="Email, Telegram e sistema"
        description="Fila única para mensagens transacionais e alertas operacionais."
        action={
          <span className="status-pill">
            <Bell size={16} />
            {events.length} eventos
          </span>
        }
      />

      <section className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 18 }}>
        <article className="metric-card">
          <Bell size={20} />
          <p>Na fila</p>
          <strong>{byStatus.queued}</strong>
          <span>aguardando envio</span>
        </article>
        <article className="metric-card">
          <Bell size={20} />
          <p>Enviadas</p>
          <strong>{byStatus.sent}</strong>
          <span>concluídas</span>
        </article>
        <article className="metric-card">
          <Bell size={20} />
          <p>Com falha</p>
          <strong>{byStatus.failed}</strong>
          <span>precisam atenção</span>
        </article>
      </section>

      <article className="panel">
        {events.length === 0 ? (
          <p className="text-muted-panel">Nenhuma notificação registrada ainda. Os eventos aparecem aqui quando o sistema enviar emails, Telegram ou alertas internos.</p>
        ) : (
          <div className="table">
            <div className="table-row table-head notifications-grid">
              <span>Tipo</span>
              <span>Canal</span>
              <span>Status</span>
              <span>Destino</span>
            </div>
            {events.map((event) => (
              <div className="table-row notifications-grid" key={event.id}>
                <strong>{event.type}</strong>
                <span>{channelLabels[event.channel] ?? event.channel}</span>
                <StatusBadge status={event.status} />
                <span>
                  {event.recipient?.full_name ?? '—'}
                  {event.recipient?.email && <small>{event.recipient.email}</small>}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  )
}
