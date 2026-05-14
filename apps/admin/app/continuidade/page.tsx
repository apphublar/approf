import { MoveRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { ContinuityRequestsPanel } from './ContinuityRequestsPanel'
import {
  childLinkRequests,
  childTransfers,
  continuityAudit,
  continuityMetrics,
} from '../lib/mock-admin-data'

export default function ContinuityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Continuidade pedagogica"
        title="Vinculos e transferencias de criancas"
        description="Aprove casos sem codigo, acompanhe transferencias entre professoras e preserve a memoria pedagogica sem expor dados sensiveis."
        action={
          <span className="status-pill">
            <ShieldCheck size={16} />
            Previa segura obrigatoria
          </span>
        }
      />

      <section className="metrics-grid">
        {continuityMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <ShieldAlert size={20} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <ContinuityRequestsPanel requests={childLinkRequests} />

        <article className="panel privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Regras</p>
              <h2>Protecao</h2>
            </div>
            <ShieldCheck size={22} />
          </div>

          <ul className="privacy-list">
            <li><ShieldCheck size={16} /> Previa sem fotos, anexos, relatorios completos ou observacoes sensiveis.</li>
            <li><ShieldCheck size={16} /> Acesso completo apenas apos vinculo aprovado.</li>
            <li><ShieldCheck size={16} /> Toda busca, aprovacao e transferencia deve gerar auditoria.</li>
            <li><ShieldCheck size={16} /> Timeline acompanha a identidade continua da crianca.</li>
          </ul>
        </article>
      </section>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Transferencias</p>
            <h2>Entre professoras ou turmas</h2>
          </div>
          <span className="status-pill">
            <MoveRight size={16} />
            Aceite ou aprovacao
          </span>
        </div>

        <div className="table">
          <div className="table-row table-head continuity-grid">
            <span>Crianca</span>
            <span>Origem</span>
            <span>Destino</span>
            <span>Status</span>
            <span>Motivo</span>
            <span>Data</span>
          </div>
          {childTransfers.map((transfer) => (
            <div className="table-row continuity-grid" key={`${transfer.child}-${transfer.date}`}>
              <strong>{transfer.child}<small>{transfer.childCode}</small></strong>
              <span>{transfer.fromTeacher}<small>{transfer.fromCode}</small></span>
              <span>{transfer.toTeacher}<small>{transfer.toCode}</small></span>
              <StatusBadge status={transfer.status} />
              <span>{transfer.reason}</span>
              <span>{transfer.date}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Auditoria</p>
            <h2>Eventos recentes</h2>
          </div>
        </div>

        <div className="table">
          <div className="table-row table-head audit-grid">
            <span>Ator</span>
            <span>Acao</span>
            <span>Alvo</span>
            <span>Data</span>
          </div>
          {continuityAudit.map((item) => (
            <div className="table-row audit-grid" key={`${item.actor}-${item.date}`}>
              <strong>{item.actor}</strong>
              <span>{item.action}</span>
              <span>{item.target}</span>
              <span>{item.date}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
