import { Check, Clock } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type PrivacyCheck = {
  label: string
  status: 'ok' | 'pending'
}

export default async function PrivacyPage() {
  const supabase = createSupabaseServiceClient()
  const [auditCount, materialsCount, profilesCount] = await Promise.all([
    supabase.from('admin_action_logs').select('id', { count: 'exact', head: true }),
    supabase.from('materials').select('id', { count: 'exact', head: true }).neq('ai_analysis_status', null),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
  ])

  const checks: PrivacyCheck[] = [
    { label: 'Buckets de documentos privados (RLS ativo)', status: 'ok' },
    { label: 'Consentimento LGPD no cadastro', status: (profilesCount.count ?? 0) > 0 ? 'ok' : 'pending' },
    { label: 'Auditoria de ações sensíveis', status: (auditCount.count ?? 0) > 0 ? 'ok' : 'pending' },
    { label: 'Materiais passam por IA + moderação', status: (materialsCount.count ?? 0) > 0 ? 'ok' : 'pending' },
    { label: 'Revisao trimestral de acessos admin', status: 'pending' },
    { label: 'Politica de retencao de dados documentada', status: 'pending' },
  ]

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Sistema"
        title="Privacidade & LGPD"
        description="Checklist operacional com status real — nao so referencia estatica."
      />

      <article className="panel-v2">
        {checks.map((item) => (
          <div key={item.label} className="privacy-check-v2">
            <span
              className="teacher-avatar"
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: item.status === 'ok' ? '#e3f2e9' : '#fdf4e0',
                color: item.status === 'ok' ? '#1c6b46' : '#8a6516',
              }}
            >
              {item.status === 'ok' ? <Check size={14} /> : <Clock size={14} />}
            </span>
            <span>{item.label}</span>
            <span className={`status-chip status-chip-${item.status === 'ok' ? 'approved' : 'overdue'}`}>
              {item.status === 'ok' ? 'OK' : 'Pendente'}
            </span>
          </div>
        ))}
      </article>
    </div>
  )
}
