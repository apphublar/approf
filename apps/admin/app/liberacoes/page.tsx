import { KeyRound } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { featureFlags, teachers } from '../lib/mock-admin-data'

export default function FeatureReleasesPage() {
  const community = featureFlags[0]

  return (
    <>
      <PageHeader
        eyebrow="Liberacoes"
        title="Controle de funcionalidades"
        description="Use esta area para liberar recursos para todas as professoras ou apenas para contas selecionadas."
        action={
          <span className="status-pill">
            <KeyRound size={16} />
            Gate por feature
          </span>
        }
      />

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Feature</p>
              <h2>{community.name}</h2>
            </div>
            <StatusBadge status={community.mode} />
          </div>

          <p className="text-muted-panel">{community.description}</p>

          <div className="release-options">
            <button className={!community.globalEnabled ? 'release-card release-card-active' : 'release-card'}>
              <strong>Selecionadas</strong>
              <span>Apenas professoras escolhidas acessam a Comunidade.</span>
            </button>
            <button className={community.globalEnabled ? 'release-card release-card-active' : 'release-card'}>
              <strong>Todas as contas</strong>
              <span>Libera a Comunidade para toda a base.</span>
            </button>
          </div>

          <div className="table">
            <div className="table-row table-head teachers-grid">
              <span>Professora</span>
              <span>Status</span>
              <span>Comunidade</span>
              <span>Acao</span>
            </div>
            {teachers.map((teacher) => {
              const allowed = community.allowedTeachers.includes(teacher.name)
              return (
                <div className="table-row teachers-grid" key={teacher.email}>
                  <span>
                    <strong>{teacher.name}</strong>
                    <small>{teacher.email}</small>
                  </span>
                  <StatusBadge status={teacher.status} />
                  <span className={`badge badge-${allowed ? 'published' : 'archived'}`}>
                    {allowed ? 'liberada' : 'oculta'}
                  </span>
                  <button className="quiet-button secondary-action">
                    {allowed ? 'Remover' : 'Liberar'}
                  </button>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Regra</p>
              <h2>Como deve funcionar</h2>
            </div>
          </div>
          <ol className="number-list">
            <li>Feature existe no app, mas pode ficar invisivel.</li>
            <li>Super Admin escolhe liberar para todos ou por professora.</li>
            <li>App consulta a permissao antes de mostrar comunidade.</li>
            <li>Alteracoes geram log de auditoria.</li>
          </ol>
        </article>
      </section>
    </>
  )
}
