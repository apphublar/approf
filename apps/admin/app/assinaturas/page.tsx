import { CreditCard, Unlock } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { liberarAcessoGratuito, updateTeacherSubscription } from './actions'

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

const planOptions = [
  { value: 'free', label: 'Gratuito' },
  { value: 'trial_15_days', label: 'Teste 15 dias' },
  { value: 'monthly', label: 'Mensal' },
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

  return (
    <>
      <PageHeader
        eyebrow="Assinaturas"
        title="Controle de acesso e pagamento"
        description="Libere acesso gratuito ou defina plano pago, status e link de pagamento por professora."
        action={
          <span className="status-pill">
            <CreditCard size={16} />
            Produção
          </span>
        }
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head subs-grid">
            <span>Professora</span>
            <span>Status atual</span>
            <span>Editar plano</span>
          </div>
          {teachers.map((teacher) => {
            const subscription = teacher.subscriptions?.[0]
            return (
              <div className="table-row subs-grid" key={teacher.id}>
                <div>
                  <strong>{teacher.full_name || 'Professora'}</strong>
                  <small>{teacher.email}</small>
                </div>

                <div>
                  <StatusBadge status={subscription?.status ?? 'blocked'} />
                  <small>{formatPlan(subscription?.plan)}</small>
                  <small>
                    {subscription?.current_period_end
                      ? `Validade: ${formatDate(subscription.current_period_end)}`
                      : 'Sem validade definida'}
                  </small>
                  {subscription?.external_reference && (
                    <a className="verification-doc-link" href={subscription.external_reference} target="_blank" rel="noreferrer">
                      Abrir link de pagamento
                    </a>
                  )}
                </div>

                <div className="subs-edit-col">
                  <form action={liberarAcessoGratuito}>
                    <input type="hidden" name="teacherId" value={teacher.id} />
                    <button className="quiet-button secondary-action subs-free-btn" type="submit">
                      <Unlock size={14} />
                      Liberar acesso gratuito
                    </button>
                  </form>

                  <div className="subs-divider" />

                  <form action={updateTeacherSubscription} className="subs-edit-form">
                    <input type="hidden" name="teacherId" value={teacher.id} />
                    <div className="subs-row-2">
                      <select name="status" defaultValue={subscription?.status ?? 'blocked'}>
                        {statusOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <select name="plan" defaultValue={subscription?.plan ?? 'verification_required'}>
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
            )
          })}
        </div>
      </article>
    </>
  )
}


function formatPlan(plan?: string | null) {
  if (!plan) return 'Sem plano'
  return planOptions.find((o) => o.value === plan)?.label ?? plan
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
