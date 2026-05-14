import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { subscriptions } from '../lib/mock-admin-data'

export default function SubscriptionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Assinaturas manuais"
        title="Controle de acesso"
        description="Enquanto o pagamento fica fora do sistema, este painel registra liberacoes, bloqueios e renovacoes."
        action={<button className="quiet-button">Nova liberacao</button>}
      />

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="table">
            <div className="table-row table-head subscriptions-grid">
              <span>Professora</span>
              <span>Status</span>
              <span>Plano</span>
              <span>Provedor</span>
              <span>Validade</span>
            </div>
            {subscriptions.map((subscription) => (
              <div className="table-row subscriptions-grid" key={subscription.teacher}>
                <strong>{subscription.teacher}</strong>
                <StatusBadge status={subscription.status} />
                <span>{subscription.plan}</span>
                <span>{subscription.provider}</span>
                <span>{subscription.endsAt}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Fluxo manual</p>
              <h2>Quando alguem pagar</h2>
            </div>
          </div>
          <ol className="number-list">
            <li>Localizar professora pelo email.</li>
            <li>Conferir pagamento no sistema externo.</li>
            <li>Selecionar plano e nova validade.</li>
            <li>Salvar e gerar log de auditoria.</li>
          </ol>
        </article>
      </section>
    </>
  )
}
