import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'

const privacyTasks = [
  'Validar consentimento antes de anexar fotos de crianças.',
  'Manter buckets de fotos e PDFs sempre privados.',
  'Auditar liberações manuais de acesso no painel interno.',
  'Revisar uso anormal de IA antes de aumentar limites.',
  'Não enviar dados completos de crianças por Telegram ou email.',
]

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Privacidade"
        title="Proteção de dados sensíveis"
        description="Regras operacionais para professoras, alunos, fotos de crianças, relatórios e notificações externas."
      />

      <section className="content-grid">
        <article className="panel panel-wide privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Checklist</p>
              <h2>Regras operacionais</h2>
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
              <h2>Buckets privados</h2>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>profile-verification</strong>
              <span className="badge badge-private">privado</span>
            </div>
            <div className="stack-item">
              <strong>material-apoio</strong>
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
