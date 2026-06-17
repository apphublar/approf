import Link from 'next/link'
import { PageHeader } from '../components/PageHeader'
import { teacherInitials } from '../lib/admin-utils'
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

  const { data: allGrants } = await supabase.from('feature_user_access').select('feature_key, user_id')
  const grantSet = new Set((allGrants ?? []).map((g) => `${g.feature_key}::${g.user_id}`))

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Conteúdo"
        title="Liberações de features"
        description="Ative funcionalidades para professoras selecionadas ou para toda a base (beta)."
      />

      {flags.length === 0 ? (
        <article className="empty-state-v2">
          <h3>Nenhuma feature cadastrada</h3>
          <p>Insira registros na tabela feature_flags no Supabase.</p>
        </article>
      ) : (
        flags.map((flag) => {
          const grantedTeachers = teachers.filter((t) => grantSet.has(`${flag.key}::${t.id}`))
          const alcance = flag.release_mode === 'all' ? 'Toda a base' : `${grantedTeachers.length} selecionada(s)`

          return (
            <article key={flag.key} className="card-row-v2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong style={{ fontSize: 15 }}>{flag.name}</strong>
                  <div style={{ fontSize: 13, color: '#8a948c', marginTop: 4 }}>{flag.description || 'Sem descrição'}</div>
                </div>
                <span style={{ fontSize: 13, color: '#5f6b63' }}>{alcance}</span>
                <div className="toggle-group-v2">
                  {(['selected', 'all'] as const).map((mode) => (
                    <form key={mode} action={setReleaseMode}>
                      <input type="hidden" name="featureKey" value={flag.key} />
                      <input type="hidden" name="featureName" value={flag.name} />
                      <input type="hidden" name="mode" value={mode} />
                      <button
                        type="submit"
                        className={flag.release_mode === mode ? 'is-active' : ''}
                        style={{
                          border: 'none',
                          borderRadius: 7,
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: flag.release_mode === mode ? '#fff' : 'transparent',
                          color: flag.release_mode === mode ? '#1c6b46' : '#5f6b63',
                          boxShadow: flag.release_mode === mode ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                        }}
                      >
                        {mode === 'selected' ? 'Selecionadas' : 'Todas'}
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              {flag.release_mode === 'selected' ? (
                <details style={{ marginTop: 16, borderTop: '1px solid #f1f0ea', paddingTop: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1c6b46' }}>
                    Gerenciar professoras selecionadas ({grantedTeachers.length})
                  </summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    {teachers.map((teacher) => {
                      const hasAccess = grantSet.has(`${flag.key}::${teacher.id}`)
                      return (
                        <div
                          key={teacher.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 9,
                            background: '#f8f8f4',
                          }}
                        >
                          <span className="teacher-avatar">{teacherInitials(teacher.full_name)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 13 }}>{teacher.full_name}</strong>
                            <div style={{ fontSize: 12, color: '#8a948c' }}>{teacher.email}</div>
                          </div>
                          <span className={`status-chip status-chip-${hasAccess ? 'approved' : 'blocked'}`}>
                            {hasAccess ? 'Liberada' : 'Oculta'}
                          </span>
                          <form action={hasAccess ? revokeAccess : grantAccess}>
                            <input type="hidden" name="featureKey" value={flag.key} />
                            <input type="hidden" name="userId" value={teacher.id} />
                            <input type="hidden" name="teacherName" value={teacher.full_name} />
                            <button type="submit" className={hasAccess ? 'btn-danger-v2 btn-sm-v2' : 'btn-secondary-v2 btn-sm-v2'}>
                              {hasAccess ? 'Remover' : 'Liberar'}
                            </button>
                          </form>
                          <Link href={`/professoras/${teacher.id}`} style={{ fontSize: 12, color: '#1c6b46' }}>
                            Ficha
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </article>
          )
        })
      )}
    </div>
  )
}
