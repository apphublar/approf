import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type AuditLog = {
  id: string
  action: string
  target_table: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor: { full_name: string } | null
}

const actionLabels: Record<string, string> = {
  teacher_subscription_updated: 'Plano atualizado',
  teacher_access_granted_free: 'Acesso gratuito liberado',
  feature_mode_updated: 'Modo de feature alterado',
  feature_access_granted: 'Acesso a feature liberado',
  feature_access_revoked: 'Acesso a feature removido',
  material_status_updated: 'Material moderado',
  verification_approved: 'Cadastro aprovado',
  verification_rejected: 'Cadastro rejeitado',
}

export default async function AuditPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('admin_action_logs')
    .select('id, action, target_table, metadata, created_at, actor:profiles!actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  const logs = (data ?? []) as unknown as AuditLog[]

  return (
    <>
      <PageHeader
        eyebrow="Auditoria"
        title="Registro de ações administrativas"
        description="Toda liberação, bloqueio, publicação e acesso sensível gera trilha de auditoria automática."
        action={
          <span className="status-pill">
            <ShieldCheck size={16} />
            {logs.length} registros
          </span>
        }
      />

      <article className="panel">
        {logs.length === 0 ? (
          <p className="text-muted-panel">Nenhum registro de auditoria ainda. As ações administrativas aparecem aqui automaticamente.</p>
        ) : (
          <div className="table">
            <div className="table-row table-head audit-grid">
              <span>Ator</span>
              <span>Ação</span>
              <span>Alvo</span>
              <span>Data</span>
            </div>
            {logs.map((log) => (
              <div className="table-row audit-grid" key={log.id}>
                <strong>{log.actor?.full_name ?? 'Sistema'}</strong>
                <span>{actionLabels[log.action] ?? log.action}</span>
                <span>{formatAlvo(log)}</span>
                <span>{formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  )
}

function formatAlvo(log: AuditLog) {
  const meta = log.metadata as Record<string, string>
  if (meta?.teacherId) return `prof · ${meta.teacherId.slice(0, 8)}…`
  if (meta?.materialId) return `material · ${meta.materialId.slice(0, 8)}…`
  if (meta?.featureKey) return `feature · ${meta.featureKey}`
  if (meta?.userId) return `user · ${meta.userId.slice(0, 8)}…`
  return log.target_table ?? '—'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
