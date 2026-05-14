import { PageHeader } from '../components/PageHeader'
import { auditLogs } from '../lib/mock-admin-data'

export default function AuditPage() {
  return (
    <>
      <PageHeader
        eyebrow="Auditoria"
        title="Registro de acoes administrativas"
        description="Toda liberacao, bloqueio, publicacao e acesso sensivel deve gerar trilha de auditoria."
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head audit-grid">
            <span>Ator</span>
            <span>Acao</span>
            <span>Alvo</span>
            <span>Data</span>
          </div>
          {auditLogs.map((log) => (
            <div className="table-row audit-grid" key={`${log.action}-${log.date}`}>
              <strong>{log.actor}</strong>
              <span>{log.action}</span>
              <span>{log.target}</span>
              <span>{log.date}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
