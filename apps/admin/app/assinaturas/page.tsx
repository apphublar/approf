import { revalidatePath } from 'next/cache'
import { CreditCard, Unlock } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'

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

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="table">
            <div className="table-row table-head subscriptions-admin-grid">
              <span>Professora</span>
              <span>Status atual</span>
              <span>Editar plano</span>
            </div>
            {teachers.map((teacher) => {
              const subscription = teacher.subscriptions?.[0]
              return (
                <div className="table-row subscriptions-admin-grid" key={teacher.id}>
                  <span>
                    <strong>{teacher.full_name || 'Professora'}</strong>
                    <small>{teacher.email}</small>
                  </span>
                  <span>
                    <StatusBadge status={subscription?.status ?? 'blocked'} />
                    <small>{formatPlan(subscription?.plan)}</small>
                    <small>{subscription?.current_period_end ? `Validade: ${formatDate(subscription.current_period_end)}` : 'Sem validade definida'}</small>
                    {subscription?.external_reference && (
                      <a className="verification-doc-link" href={subscription.external_reference} target="_blank" rel="noreferrer">
                        Abrir link de pagamento
                      </a>
                    )}
                  </span>
                  <span className="edit-plan-cell">
                    <form action={liberarAcessoGratuito} className="release-free-form">
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <button className="quiet-button secondary-action" type="submit">
                        <Unlock size={14} />
                        Liberar acesso gratuito
                      </button>
                    </form>
                    <div className="cell-divider" />
                    <form action={updateTeacherSubscription} className="inline-form">
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <select name="status" defaultValue={subscription?.status ?? 'blocked'}>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select name="plan" defaultValue={subscription?.plan ?? 'verification_required'}>
                        {planOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input name="paymentLink" defaultValue={subscription?.external_reference ?? ''} placeholder="https://link-de-pagamento..." />
                      <input name="currentPeriodEnd" type="date" defaultValue={toDateInput(subscription?.current_period_end)} />
                      <textarea name="notes" defaultValue={subscription?.notes ?? ''} placeholder="Observações internas" />
                      <button className="quiet-button" type="submit">
                        Salvar plano
                      </button>
                    </form>
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Fluxo de acesso</p>
              <h2>Como liberar</h2>
            </div>
          </div>
          <ol className="number-list">
            <li><strong>Gratuito:</strong> clique "Liberar acesso gratuito" — sem plano nem pagamento.</li>
            <li><strong>Pago:</strong> escolha Mensal ou Anual, cole o link de pagamento e salve.</li>
            <li>Use status <strong>Ativa</strong> após confirmação do pagamento.</li>
            <li><strong>Bloqueada</strong> impede acesso no app da professora.</li>
          </ol>
        </article>
      </section>
    </>
  )
}

async function liberarAcessoGratuito(formData: FormData) {
  'use server'
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  if (!teacherId) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: teacherId,
      status: 'active',
      plan: 'free',
      provider: 'manual',
      external_reference: null,
      trial_expires_at: null,
      current_period_end: null,
      notes: 'Acesso gratuito liberado pelo admin.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_access_granted_free',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status: 'active', plan: 'free' },
  })
  revalidatePath('/assinaturas')
  revalidatePath('/professoras')
}

async function updateTeacherSubscription(formData: FormData) {
  'use server'
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as SubscriptionStatus
  const plan = String(formData.get('plan') ?? '').trim()
  const paymentLink = String(formData.get('paymentLink') ?? '').trim()
  const currentPeriodEnd = String(formData.get('currentPeriodEnd') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!teacherId || !statusOptions.some((option) => option.value === status)) return
  if (!planOptions.some((option) => option.value === plan)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: teacherId,
      status,
      plan,
      provider: 'manual',
      external_reference: plan === 'free' ? null : (paymentLink || null),
      trial_expires_at: plan === 'trial_15_days' && currentPeriodEnd ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString() : null,
      current_period_end: plan !== 'free' && currentPeriodEnd ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString() : null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_subscription_updated',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status, plan, paymentLink: paymentLink || null, currentPeriodEnd: currentPeriodEnd || null },
  })
  revalidatePath('/assinaturas')
  revalidatePath('/professoras')
}

function formatPlan(plan?: string | null) {
  if (!plan) return 'Sem plano'
  return planOptions.find((option) => option.value === plan)?.label ?? plan
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
