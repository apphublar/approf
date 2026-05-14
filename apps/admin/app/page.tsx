import { AlertTriangle, Bot, CheckCircle2, FileText, ShieldCheck } from 'lucide-react'
import { PageHeader } from './components/PageHeader'
import { StatusBadge } from './components/StatusBadge'
import { dashboardMetrics, materials, privacyTasks, teachers } from './lib/mock-admin-data'

export default function AdminHome() {
  return (
    <>
      <PageHeader
        eyebrow="Super Admin MVP"
        title="Controle operacional do Approf"
        description="Visao geral de professoras, assinaturas manuais, materiais, IA e riscos de privacidade."
        action={
          <span className="status-pill">
            <ShieldCheck size={16} />
            RLS desde o dia 1
          </span>
        }
      />

      <section className="metrics-grid" aria-label="Metricas principais">
        {dashboardMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <article className="metric-card" key={metric.label}>
              <Icon size={20} />
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </article>
          )
        })}
      </section>

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Acesso</p>
              <h2>Professoras recentes</h2>
            </div>
            <a className="quiet-button" href="/professoras">Ver todas</a>
          </div>

          <div className="table">
            <div className="table-row table-head teachers-grid">
              <span>Professora</span>
              <span>Status</span>
              <span>Turmas</span>
              <span>IA</span>
            </div>
            {teachers.map((teacher) => (
              <div className="table-row teachers-grid" key={teacher.email}>
                <span>
                  <strong>{teacher.name}</strong>
                  <small>{teacher.email}</small>
                </span>
                <StatusBadge status={teacher.status} />
                <span>{teacher.classes} turmas</span>
                <span>{teacher.aiReports} relatorios</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Materiais</p>
              <h2>Biblioteca publicada</h2>
            </div>
            <FileText size={20} />
          </div>
          <div className="stack-list">
            {materials.slice(0, 3).map((material) => (
              <div className="stack-item" key={material.title}>
                <span>
                  <strong>{material.title}</strong>
                  <small>{material.category}</small>
                </span>
                <StatusBadge status={material.status} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dados sensiveis</p>
              <h2>Checklist de privacidade</h2>
            </div>
            <Bot size={20} />
          </div>

          <ul className="privacy-list">
            {privacyTasks.slice(0, 4).map((task) => (
              <li key={task}>
                <CheckCircle2 size={16} />
                {task}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel alert-panel">
          <AlertTriangle size={22} />
          <div>
            <p className="eyebrow">Aguardando Supabase</p>
            <h2>Dados reais entram depois da validacao</h2>
            <p>As telas agora definem o fluxo operacional. Depois vamos trocar mocks por consultas protegidas com RLS.</p>
          </div>
        </article>
      </section>
    </>
  )
}
