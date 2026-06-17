import { Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { formatRelativeDate } from '../lib/admin-utils'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type AuditLog = {
  id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor: { full_name: string } | null
}

const actionLabels: Record<string, string> = {
  teacher_subscription_updated: 'Plano atualizado',
  teacher_access_granted_free: 'Acesso gratuito liberado',
  teacher_giztokens_adjusted: 'GizTokens ajustados',
  teacher_payment_overdue_notice_sent: 'Aviso de atraso enviado',
  teacher_access_blocked_manual: 'Conta bloqueada',
  feature_mode_updated: 'Modo de feature alterado',
  feature_access_granted: 'Acesso a feature liberado',
  feature_access_revoked: 'Acesso a feature removido',
  material_status_updated: 'Material moderado',
  verification_approved: 'Verificacao aprovada',
  verification_rejected: 'Verificacao rejeitada',
  teacher_verification_updated: 'Verificacao atualizada',
  app_announcement_sent: 'Aviso enviado ao app',
}

export default async function AuditPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('admin_action_logs')
    .select('id, action, target_table, target_id, metadata, created_at, actor:profiles!actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  const logs = (data ?? []) as unknown as AuditLog[]

  const teacherIds = Array.from(
    new Set(
      logs.flatMap((log) => {
        const meta = log.metadata ?? {}
        if (typeof meta.teacherId === 'string') return [meta.teacherId]
        if (log.target_id) return [log.target_id]
        return []
      }),
    ),
  )

  const profilesResult = teacherIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', teacherIds)
    : { data: [], error: null }
  if (profilesResult.error) throw new Error(profilesResult.error.message)
  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Sistema"
        title="Auditoria"
        description="Prova de tudo que foi feito pela equipe — com o nome da professora, nao so o ID."
      />

      <article className="audit-list-v2">
        {logs.length === 0 ? (
          <div className="empty-state-v2"><p>Nenhum registro de auditoria ainda.</p></div>
        ) : (
          logs.map((log) => {
            const target = formatAlvo(log, profileById)
            return (
              <div key={log.id} className="audit-item-v2">
                <Check size={16} color="#1c6b46" />
                <div style={{ flex: 1 }}>
                  <strong>
                    {actionLabels[log.action] ?? log.action} · <span style={{ color: '#1c6b46' }}>{target.name}</span>
                  </strong>
                  <small>{target.detail} · por {log.actor?.full_name ?? 'Sistema'}</small>
                </div>
                <time>{formatRelativeDate(log.created_at)}</time>
              </div>
            )
          })
        )}
      </article>
    </div>
  )
}

function formatAlvo(
  log: AuditLog,
  profileById: Map<string, { full_name: string; email: string }>,
) {
  const meta = log.metadata ?? {}
  const teacherId = typeof meta.teacherId === 'string' ? meta.teacherId : log.target_id
  const profile = teacherId ? profileById.get(teacherId) : undefined
  const name =
    (typeof meta.teacherName === 'string' && meta.teacherName) ||
    profile?.full_name ||
    profile?.email ||
    'Registro interno'

  let detail = 'Acao administrativa'
  if (typeof meta.reason === 'string' && meta.reason) detail = meta.reason
  else if (typeof meta.amount === 'number') detail = `${meta.mode === 'set_minimum' ? 'minimo' : `+${meta.amount}`} Giz`
  else if (typeof meta.title === 'string') detail = `"${meta.title}"`

  return { name, detail }
}
