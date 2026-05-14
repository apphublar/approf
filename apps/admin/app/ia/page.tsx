import { PageHeader } from '../components/PageHeader'
import { aiUsage } from '../lib/mock-admin-data'

export default function AiUsagePage() {
  return (
    <>
      <PageHeader
        eyebrow="Uso de IA"
        title="Relatorios e custos"
        description="Controle tokens, custos estimados e uso anormal antes de liberar limites maiores."
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head ai-grid">
            <span>Professora</span>
            <span>Relatorios</span>
            <span>Tokens</span>
            <span>Custo</span>
            <span>Status</span>
          </div>
          {aiUsage.map((usage) => (
            <div className="table-row ai-grid" key={usage.teacher}>
              <strong>{usage.teacher}</strong>
              <span>{usage.reports}</span>
              <span>{usage.tokens}</span>
              <span>{usage.cost}</span>
              <span className={`badge badge-${usage.flag}`}>{usage.flag}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
