import { KeyRound } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { grantAccess, revokeAccess, setReleaseMode } from './actions'

export const dynamic = 'force-dynamic'

type FeatureFlag = {
  key: string
  name: string
  release_mode: 'off' | 'selected' | 'all'
  description: string | null
}

type Teacher = {
  id: string
  full_name: string
  email: string
}

export default async function FeatureReleasesPage() {
  const supabase = createSupabaseServiceClient()

  const [flagsResult, teachersResult] = await Promise.all([
    supabase.from('feature_flags').select('key, name, release_mode, description').order('name'),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher').order('full_name').limit(300),
  ])

  if (flagsResult.error) throw new Error(flagsResult.error.message)
  if (teachersResult.error) throw new Error(teachersResult.error.message)

  const flags = (flagsResult.data ?? []) as FeatureFlag[]
  const teachers = (teachersResult.data ?? []) as Teacher[]

  // Fetch all grants for all flags at once
  const { data: allGrants } = await supabase
    .from('feature_user_access')
    .select('feature_key, user_id')

  const grantSet = new Set((allGrants ?? []).map((g) => `${g.feature_key}::${g.user_id}`))

  const modeLabel: Record<string, string> = {
    off: 'Desativada',
    selected: 'Selecionadas',
    all: 'Todas as contas',
  }

  return (
    <>
      <PageHeader
        eyebrow="Liberacoes"
        title="Controle de funcionalidades"
        description="Libere recursos para todas as professoras ou apenas para contas selecionadas. Cada alteração gera log de auditoria."
        action={
          <span className="status-pill">
            <KeyRound size={16} />
            {flags.length} feature{flags.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {flags.length === 0 ? (
        <article className="panel">
          <p className="text-muted-panel">
            Nenhuma feature flag cadastrada ainda. Insira registros na tabela <strong>feature_flags</strong> no Supabase para controlar funcionalidades aqui.
          </p>
        </article>
      ) : (
        flags.map((flag) => {
          const grantedTeachers = teachers.filter((t) => grantSet.has(`${flag.key}::${t.id}`))

          return (
            <section key={flag.key} className="content-grid" style={{ marginBottom: 18 }}>
              <article className="panel panel-wide">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Feature</p>
                    <h2>{flag.name}</h2>
                  </div>
                  <StatusBadge status={flag.release_mode === 'all' ? 'active' : flag.release_mode === 'selected' ? 'trial' : 'blocked'} />
                </div>

                {flag.description && <p className="text-muted-panel">{flag.description}</p>}

                <div className="release-options">
                  {(['selected', 'all'] as const).map((mode) => (
                    <form key={mode} action={setReleaseMode}>
                      <input type="hidden" name="featureKey" value={flag.key} />
                      <input type="hidden" name="mode" value={mode} />
                      <button
                        type="submit"
                        className={`release-card ${flag.release_mode === mode ? 'release-card-active' : ''}`}
                      >
                        <strong>{mode === 'selected' ? 'Selecionadas' : 'Todas as contas'}</strong>
                        <span>
                          {mode === 'selected'
                            ? `Apenas as ${grantedTeachers.length} professora(s) escolhidas acessam ${flag.name}.`
                            : `Libera ${flag.name} para toda a base de professoras.`}
                        </span>
                      </button>
                    </form>
                  ))}
                </div>

                <div className="table">
                  <div className="table-row table-head teachers-grid">
                    <span>Professora</span>
                    <span>Status de acesso</span>
                    <span>{flag.name}</span>
                    <span>Ação</span>
                  </div>
                  {teachers.length === 0 ? (
                    <div className="table-row">
                      <span style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>Nenhuma professora cadastrada.</span>
                    </div>
                  ) : (
                    teachers.map((teacher) => {
                      const hasAccess = grantSet.has(`${flag.key}::${teacher.id}`)
                      return (
                        <div className="table-row teachers-grid" key={teacher.id}>
                          <div>
                            <strong>{teacher.full_name}</strong>
                            <small>{teacher.email}</small>
                          </div>
                          <span className={`badge badge-${hasAccess ? 'published' : 'archived'}`}>
                            {hasAccess ? 'liberada' : 'oculta'}
                          </span>
                          <span>{flag.name}</span>
                          <form action={hasAccess ? revokeAccess : grantAccess}>
                            <input type="hidden" name="featureKey" value={flag.key} />
                            <input type="hidden" name="userId" value={teacher.id} />
                            <button className="quiet-button secondary-action" type="submit">
                              {hasAccess ? 'Remover' : 'Liberar'}
                            </button>
                          </form>
                        </div>
                      )
                    })
                  )}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Modo atual</p>
                    <h2>{modeLabel[flag.release_mode]}</h2>
                  </div>
                </div>
                <ol className="number-list">
                  <li>Feature existe no app mas pode ficar invisível.</li>
                  <li><strong>Selecionadas:</strong> apenas as professoras marcadas acessam.</li>
                  <li><strong>Todas as contas:</strong> libera para toda a base.</li>
                  <li>Toda alteração gera log de auditoria automático.</li>
                </ol>
              </article>
            </section>
          )
        })
      )}
    </>
  )
}
