import { MoveRight, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { requireAdminSession } from '../lib/admin-auth'
import { listContinuityRequestsForAdmin } from '../lib/continuity'
import { ContinuityRequestsPanel } from './ContinuityRequestsPanel'

export default async function ContinuityPage() {
  await requireAdminSession()
  const requests = await listContinuityRequestsForAdmin()

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
        <ContinuityRequestsPanel initialRequests={requests} />

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
            <li><ShieldCheck size={16} /> Toda busca, aprovação e transferência gera auditoria.</li>
            <li><ShieldCheck size={16} /> Timeline acompanha a identidade contínua da criança.</li>
          </ul>
        </article>
      </section>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Operação</p>
            <h2>Como aprovar</h2>
          </div>
          <span className="status-pill">
            <MoveRight size={16} />
            Turma destino obrigatória
          </span>
        </div>
        <p className="text-muted-panel">
          Para aprovar vínculos ou transferências entre professoras, informe o ID da turma de destino da professora solicitante antes de clicar em Aprovar.
        </p>
      </article>
    </>
  )
}
