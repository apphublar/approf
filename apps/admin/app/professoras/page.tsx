import Link from 'next/link'
import { Coins } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { getCurrentMonthPeriod, loadTeacherWalletsForMonth } from '../lib/giztokens-admin'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { adjustTeacherGiztokensAction } from './actions'

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
  const { start: monthStart, end: monthEnd } = getCurrentMonthPeriod()
  const wallets = await loadTeacherWalletsForMonth(teachers.map((teacher) => teacher.id), monthStart)

  return (
    <>
      <PageHeader
        eyebrow="Professoras"
        title="Usuarias cadastradas"
        description="Cadastros reais, status de acesso, verificacao automatica e uso do app em producao."
        action={<Link className="quiet-button" href="/assinaturas">Gerenciar planos</Link>}
      />

      <article className="panel subscriptions-bulk-panel">
        <div>
          <h2>Ajustar GizTokens do mes</h2>
          <p>
            Libere saldo extra para uma professora escolhida. O ajuste vale para o ciclo mensal atual
            ({formatMonthLabel(monthStart)} a {formatMonthLabel(monthEnd)}).
          </p>
        </div>
        <form action={adjustTeacherGiztokensAction} className="subs-edit-form giztokens-admin-form">
          <div className="giztokens-admin-grid">
            <label>
              <span>Professora</span>
              <select name="teacherId" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name || 'Professora'} ({teacher.email})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tipo de ajuste</span>
              <select name="mode" defaultValue="add">
                <option value="add">Adicionar GizTokens</option>
                <option value="set_minimum">Definir saldo minimo do mes</option>
              </select>
            </label>
            <label>
              <span>Quantidade</span>
              <input name="amount" type="number" min={1} max={100000} step={1} placeholder="Ex.: 5000" required />
            </label>
          </div>
          <label>
            <span>Observacao interna (auditoria)</span>
            <textarea name="reason" rows={2} placeholder="Motivo do ajuste para a trilha de auditoria." />
          </label>
          <button className="quiet-button secondary-action" type="submit">
            <Coins size={14} />
            Aplicar ajuste
          </button>
        </form>
      </article>

      <article className="panel">
        <div className="table">
          <div className="table-row table-head teachers-page-grid">
            <span>Professora</span>
            <span>Acesso</span>
            <span>Cadastro</span>
            <span>Turmas</span>
            <span>Alunos</span>
            <span>IA</span>
            <span>GizTokens</span>
          </div>
          {teachers.map((teacher) => {
            const subscription = teacher.subscriptions?.[0]
            const verification = latestVerification(teacher.teacher_profile_verifications ?? [])
            const wallet = wallets.get(teacher.id)
            return (
              <div className="table-row teachers-page-grid" key={teacher.id}>
                <span>
                  <strong>{teacher.full_name || 'Professora'}</strong>
                  <small>{teacher.email}</small>
                  {teacher.phone && <small>{teacher.phone}</small>}
                </span>
                <span>
                  <StatusBadge status={subscription?.status ?? 'active'} />
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
                <span>
                  {wallet ? (
                    <>
                      <strong>{formatNumber(wallet.giztokensRemaining)}</strong>
                      <small>de {formatNumber(wallet.giztokensIncluded)} neste mes</small>
                      <small>{formatNumber(wallet.giztokensUsed)} usados</small>
                    </>
                  ) : (
                    <>
                      <strong>—</strong>
                      <small>Sem carteira neste mes</small>
                    </>
                  )}
                </span>
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
    trial_7_days: 'Teste 7 dias',
    trial_15_days: 'Teste 15 dias',
    monthly: 'Mensal',
    semiannual: 'Semestral',
    annual: 'Anual',
    verification_required: 'Aguardando analise',
  }
  return labels[plan] ?? plan
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value))
}
