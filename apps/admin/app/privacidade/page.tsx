import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { privacyTasks } from '../lib/mock-admin-data'

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Privacidade"
        title="Protecao de dados sensiveis"
        description="Regras operacionais para professoras, alunos, fotos de criancas, relatorios e notificacoes externas."
      />

      <section className="content-grid">
        <article className="panel panel-wide privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Checklist</p>
              <h2>Antes de usuarias reais</h2>
            </div>
            <LockKeyhole size={20} />
          </div>
          <ul className="privacy-list">
            {privacyTasks.map((task) => (
              <li key={task}>
                <CheckCircle2 size={16} />
                {task}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Storage</p>
              <h2>Arquivos privados</h2>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>child-photos</strong>
              <span className="badge badge-private">privado</span>
            </div>
            <div className="stack-item">
              <strong>report-exports</strong>
              <span className="badge badge-private">privado</span>
            </div>
            <div className="stack-item">
              <strong>material-files</strong>
              <span className="badge badge-published">download app</span>
            </div>
          </div>
        </article>
      </section>
    </>
  )
}
