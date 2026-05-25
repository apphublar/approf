import { MoveRight, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'

export default function ContinuityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Continuidade pedagógica"
        title="Vínculos e transferências de crianças"
        description="Aprove casos sem código, acompanhe transferências entre professoras e preserve a memória pedagógica sem expor dados sensíveis."
        action={
          <span className="status-pill">
            <ShieldCheck size={16} />
            Prévia segura obrigatória
          </span>
        }
      />

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Solicitações</p>
              <h2>Vínculo de criança existente</h2>
            </div>
          </div>
          <p className="text-muted-panel">
            Nenhuma solicitação pendente. As professoras ainda não iniciaram pedidos de vínculo pelo app — os casos aparecerão aqui quando essa funcionalidade estiver ativa na plataforma.
          </p>
        </article>

        <article className="panel privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Regras</p>
              <h2>Proteção</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <ul className="privacy-list">
            <li><ShieldCheck size={16} /> Prévia sem fotos, anexos, relatórios completos ou observações sensíveis.</li>
            <li><ShieldCheck size={16} /> Acesso completo apenas após vínculo aprovado.</li>
            <li><ShieldCheck size={16} /> Toda busca, aprovação e transferência deve gerar auditoria.</li>
            <li><ShieldCheck size={16} /> Timeline acompanha a identidade contínua da criança.</li>
          </ul>
        </article>
      </section>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Transferências</p>
            <h2>Entre professoras ou turmas</h2>
          </div>
          <span className="status-pill">
            <MoveRight size={16} />
            Aceite ou aprovação
          </span>
        </div>
        <p className="text-muted-panel">
          Nenhuma transferência registrada. As transferências entre professoras ou turmas aparecerão aqui quando solicitadas pelo app.
        </p>
      </article>
    </>
  )
}
