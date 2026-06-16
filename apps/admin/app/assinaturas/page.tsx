import { AlertTriangle, Bell, CreditCard, Lock, ShieldCheck, Unlock } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import {
  blockAllOverdueAccess,
  blockTeacherAccess,
  liberarAcessoGratuito,
  sendAllPaymentOverdueNotices,
  sendPaymentOverdueNotice,
  updateTeacherSubscription,
} from './actions'

export const dynamic = 'force-dynamic'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

type TeacherSubscriptionRow = {
  id: string
  full_name: string
  email: string
  subscriptions?: Array<{
    id: string
    status: SubscriptionStatus
    plan: string
    provider: string
    external_reference: string | null
    trial_expires_at: string | null
    current_period_end: string | null
    notes: string | null
  }>
}

type TeacherSubscription = NonNullable<TeacherSubscriptionRow['subscriptions']>[number]

const planOptions = [
  { value: 'free', label: 'Gratuito' },
  { value: 'trial_7_days', label: 'Teste 7 dias' },
  { value: 'trial_15_days', label: 'Teste 15 dias' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'verification_required', label: 'Em analise' },
]

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: 'trial', label: 'Teste' },
  { value: 'active', label: 'Ativa' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'canceled', label: 'Cancelada' },
]

export default async function SubscriptionsPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscriptions(id, status, plan, provider, external_reference, trial_expires_at, current_period_end, notes)')
    .eq('role', 'teacher')
    .order('full_name', { ascending: true })
    .limit(300)

  if (error) throw new Error(error.message)
  const teachers = (data ?? []) as TeacherSubscriptionRow[]
  const classified = teachers.map((teacher) => {
    const subscription = teacher.subscriptions?.[0] ?? null
    return { teacher, subscription, access: resolveAccessState(subscription) }
  })
  const overdueTeachers = classified.filter((item) => item.access === 'overdue')

  return (
    <>
      <PageHeader
        eyebrow="Assinaturas"
        title="Acesso e pagamento"
        description="Atraso nao bloqueia automaticamente. O admin avisa, acompanha e decide quando bloquear uma conta."
        action={
          <span className="status-pill">
            <CreditCard size={16} />
            Manual
          </span>
        }
      />

      <section className="metrics-grid subscriptions-metrics">
        <Metric icon={<Unlock size={19} />} label="Acesso livre" value={countAccess(classified, 'free')} detail="gratuitas ou teste" />
        <Metric icon={<ShieldCheck size={19} />} label="Pagando em dia" value={countAccess(classified, 'paid_ok')} detail="mensal/anual ativo" />
        <Metric icon={<AlertTriangle size={19} />} label="Em atraso" value={countAccess(classified, 'overdue')} detail="avisar antes de bloquear" />
        <Metric icon={<Lock size={19} />} label="Bloqueadas" value={countAccess(classified, 'blocked')} detail="bloqueio manual" />
      </section>

      {overdueTeachers.length > 0 && (
        <article className="panel subscriptions-bulk-panel">
          <div>
            <h2>{overdueTeachers.length} conta(s) com pagamento em atraso</h2>
            <p>Envie aviso no app da professora. Se nao resolver, bloqueie individualmente ou todas em atraso de uma vez.</p>
          </div>
          <div className="subscriptions-bulk-actions">
            <form action={sendAllPaymentOverdueNotices}>
              <button className="quiet-button secondary-action" type="submit">
                <Bell size={14} />
                Avisar todas
              </button>
            </form>
            <form action={blockAllOverdueAccess}>
              <button className="quiet-button danger-action" type="submit">
                <Lock size={14} />
                Bloquear todas em atraso
              </button>
            </form>
          </div>
        </article>
      )}

      <article className="panel">
        <div className="table">
          <div className="table-row table-head subs-grid">
            <span>Professora</span>
            <span>Situação</span>
            <span>Ações e plano</span>
          </div>
          {classified.map(({ teacher, subscription, access }) => (
            <div className="table-row subs-grid" key={teacher.id}>
              <div>
                <strong>{teacher.full_name || 'Professora'}</strong>
                <small>{teacher.email}</small>
              </div>

              <div>
                <StatusBadge status={access} />
                <small>{formatPlan(subscription?.plan)}</small>
                <small>{formatAccessDetail(subscription, access)}</small>
                {subscription?.external_reference && (
                  <a className="verification-doc-link" href={subscription.external_reference} target="_blank" rel="noreferrer">
                    Abrir link de pagamento
                  </a>
                )}
              </div>

              <div className="subs-edit-col">
                <div className="subs-action-row">
                  <form action={liberarAcessoGratuito}>
                    <input type="hidden" name="teacherId" value={teacher.id} />
                    <button className="quiet-button secondary-action" type="submit">
                      <Unlock size={14} />
                      Liberar grátis
                    </button>
                  </form>
                  {access === 'overdue' && (
                    <form action={sendPaymentOverdueNotice}>
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <button className="quiet-button secondary-action" type="submit">
                        <Bell size={14} />
                        Avisar atraso
                      </button>
                    </form>
                  )}
                  {access !== 'blocked' && (
                    <form action={blockTeacherAccess}>
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <button className="quiet-button danger-action" type="submit">
                        <Lock size={14} />
                        Bloquear
                      </button>
                    </form>
                  )}
                </div>

                <div className="subs-divider" />

                <form action={updateTeacherSubscription} className="subs-edit-form">
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <div className="subs-row-2">
                    <select name="status" defaultValue={subscription?.status ?? 'active'}>
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <select name="plan" defaultValue={subscription?.plan ?? 'free'}>
                      {planOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    name="paymentLink"
                    defaultValue={subscription?.external_reference ?? ''}
                    placeholder="https://link-de-pagamento..."
                  />
                  <div className="subs-row-2">
                    <input name="currentPeriodEnd" type="date" defaultValue={toDateInput(subscription?.current_period_end)} />
                    <textarea name="notes" defaultValue={subscription?.notes ?? ''} placeholder="Observações internas" rows={2} />
                  </div>
                  <button className="quiet-button subs-save-btn" type="submit">
                    Salvar plano
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return (
    <article className="metric-card">
      {icon}
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  )
}

function resolveAccessState(subscription?: TeacherSubscription | null) {
  if (!subscription) return 'free'
  if (subscription.status === 'blocked') return 'blocked'
  if (subscription.status === 'canceled') return 'canceled'
  if (isPaymentOverdue(subscription)) return 'overdue'
  if (['monthly', 'semiannual', 'annual'].includes(subscription.plan)) return 'paid_ok'
  return 'free'
}

function isPaymentOverdue(subscription: TeacherSubscription) {
  if (subscription.status === 'overdue') return true
  if (!['monthly', 'semiannual', 'annual'].includes(subscription.plan)) return false
  if (!subscription.current_period_end) return false
  return new Date(subscription.current_period_end).getTime() < Date.now()
}

function countAccess(items: Array<{ access: string }>, access: string) {
  return items.filter((item) => item.access === access).length
}

function formatPlan(plan?: string | null) {
  if (!plan) return 'Sem plano'
  return planOptions.find((o) => o.value === plan)?.label ?? plan
}

function formatAccessDetail(subscription: TeacherSubscription | null, access: string) {
  if (!subscription) return 'Acesso liberado sem cobrança'
  if (access === 'free') return subscription.current_period_end ? `Liberado ate ${formatDate(subscription.current_period_end)}` : 'Acesso livre'
  if (access === 'paid_ok') return subscription.current_period_end ? `Em dia ate ${formatDate(subscription.current_period_end)}` : 'Pagamento em dia'
  if (access === 'overdue') return subscription.current_period_end ? `Venceu em ${formatDate(subscription.current_period_end)}` : 'Marcada em atraso'
  if (access === 'blocked') return 'Acesso bloqueado manualmente'
  if (access === 'canceled') return 'Conta cancelada'
  return subscription.current_period_end ? `Validade: ${formatDate(subscription.current_period_end)}` : 'Sem validade definida'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
