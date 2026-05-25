import Link from 'next/link'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type TeacherRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
  subscriptions?: Array<{
    status: string
    plan: string
    current_period_end: string | null
    external_reference: string | null
  }>
  schools?: Array<{ id: string }>
  classes?: Array<{ id: string }>
  students?: Array<{ id: string }>
  teacher_profile_verifications?: Array<{ status: string; updated_at: string }>
  ai_generation_logs?: Array<{ id: string }>
}

export default async function TeachersPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      phone,
      created_at,
      subscriptions(status, plan, current_period_end, external_reference),
      schools(id),
      classes(id),
      students(id),
      teacher_profile_verifications(status, updated_at),
      ai_generation_logs(id)
    `)
    .eq('role', 'teacher')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  const teachers = (data ?? []) as TeacherRow[]

  return (
    <>
      <PageHeader
        eyebrow="Professoras"
        title="Usuarias cadastradas"
        description="Cadastros reais, status de acesso, verificação automatica e uso do app em produção."
        action={<Link className="quiet-button" href="/assinaturas">Gerenciar planos</Link>}
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head teachers-page-grid">
            <span>Professora</span>
            <span>Acesso</span>
            <span>Cadastro</span>
            <span>Turmas</span>
            <span>Alunos</span>
            <span>IA</span>
          </div>
          {teachers.map((teacher) => {
            const subscription = teacher.subscriptions?.[0]
            const verification = latestVerification(teacher.teacher_profile_verifications ?? [])
            return (
              <div className="table-row teachers-page-grid" key={teacher.id}>
                <span>
                  <strong>{teacher.full_name || 'Professora'}</strong>
                  <small>{teacher.email}</small>
                  {teacher.phone && <small>{teacher.phone}</small>}
                </span>
                <span>
                  <StatusBadge status={subscription?.status ?? 'blocked'} />
                  <small>{formatPlan(subscription?.plan)}</small>
                  {subscription?.current_period_end && <small>Valido ate {formatDate(subscription.current_period_end)}</small>}
                  {subscription?.external_reference && (
                    <a className="verification-doc-link" href={subscription.external_reference} target="_blank" rel="noreferrer">
                      Link de pagamento
                    </a>
                  )}
                </span>
                <span>
                  <StatusBadge status={verification?.status ?? 'pending'} />
                  <small>{verification?.status === 'approved' ? 'Liberado' : 'Em analise'}</small>
                </span>
                <span>{teacher.classes?.length ?? 0}</span>
                <span>{teacher.students?.length ?? 0}</span>
                <span>{teacher.ai_generation_logs?.length ?? 0}</span>
              </div>
            )
          })}
        </div>
      </article>
    </>
  )
}

function latestVerification(items: Array<{ status: string; updated_at: string }>) {
  return [...items].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null
}

function formatPlan(plan?: string | null) {
  if (!plan) return 'Sem plano'
  const labels: Record<string, string> = {
    free: 'Gratuito',
    trial_15_days: 'Teste 15 dias',
    monthly: 'Mensal',
    annual: 'Anual',
    verification_required: 'Aguardando analise',
  }
  return labels[plan] ?? plan
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}
