import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { notifications } from '../lib/mock-admin-data'

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notificacoes"
        title="Email, Telegram e sistema"
        description="Fila unica para mensagens transacionais e alertas, sempre evitando expor dados completos de criancas."
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head notifications-grid">
            <span>Tipo</span>
            <span>Canal</span>
            <span>Status</span>
            <span>Destino</span>
          </div>
          {notifications.map((notification) => (
            <div className="table-row notifications-grid" key={`${notification.type}-${notification.target}`}>
              <strong>{notification.type}</strong>
              <span>{notification.channel}</span>
              <StatusBadge status={notification.status} />
              <span>{notification.target}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
