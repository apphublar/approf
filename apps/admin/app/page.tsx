import Link from 'next/link'
import { AlertTriangle, Bolt, CreditCard, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from './components/PageHeader'
import {
  accessStatusFromSubscription,
  formatCompactNumber,
  formatCurrencyFromCents,
  formatNumberPt,
  formatPlanLabel,
  teacherInitials,
} from './lib/admin-utils'
import { createSupabaseServiceClient } from './lib/supabase-server'
import { getCurrentMonthPeriod } from './lib/giztokens-admin'

export const dynamic = 'force-dynamic'

type TeacherRow = {
  id: string
  full_name: string
  email: string
  subscriptions?: Array<{ status: string; plan: string; current_period_end: string | null }>
  classes?: Array<{ id: string }>
  ai_generation_logs?: Array<{ id: string }>
}

export default async function AdminHome() {
  const supabase = createSupabaseServiceClient()
  const { start: monthStart } = getCurrentMonthPeriod()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [
    teachersResult,
    subscriptionsResult,
    verificationsResult,
    reportsResult,
    aiResult,
    walletsResult,
    gizBonusResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, subscriptions(status, plan, current_period_end), classes(id), ai_generation_logs(id)')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('subscriptions').select('status, plan, current_period_end'),
    supabase.from('teacher_profile_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('material_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase
      .from('ai_generation_logs')
      .select('id, actual_cost_cents, estimated_cost_cents')
      .gte('created_at', since.toISOString()),
    supabase
      .from('ai_usage_wallets')
      .select('giztokens_included, notes')
      .eq('period_type', 'monthly')
      .eq('period_start', monthStart),
    supabase
      .from('admin_action_logs')
      .select('metadata')
      .eq('action', 'teacher_giztokens_adjusted')
      .gte('created_at', `${monthStart}T00:00:00`),
  ])

  if (teachersResult.error) throw new Error(teachersResult.error.message)
  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message)
  if (aiResult.error) throw new Error(aiResult.error.message)

  const teachers = (teachersResult.data ?? []) as TeacherRow[]
  const subscriptions = subscriptionsResult.data ?? []
  const aiLogs = aiResult.data ?? []
  const aiCost = aiLogs.reduce((sum, item) => sum + Number(item.actual_cost_cents || item.estimated_cost_cents || 0), 0)

  const paying = subscriptions.filter(
    (item) =>
      item.status === 'active' &&
      ['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(item.plan),
  ).length
  const trials = subscriptions.filter((item) => item.status === 'trial').length
  const overdue = subscriptions.filter((item) => {
    if (item.status === 'overdue') return true
    if (!['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(item.plan)) return false
    if (!item.current_period_end) return false
    return new Date(item.current_period_end).getTime() < Date.now()
  }).length

  const gizBonusFromAudit = (gizBonusResult.data ?? []).reduce((sum, row) => {
    const meta = row.metadata as { amount?: number; mode?: string }
    if (meta.mode === 'add' && typeof meta.amount === 'number') return sum + meta.amount
    return sum
  }, 0)

  const gizBonusFallback = (walletsResult.data ?? []).reduce((sum, row) => {
    const notes = String(row.notes ?? '')
    const matches = [...notes.matchAll(/Ajuste admin \(\+(\d+)/g)]
    return sum + matches.reduce((inner, match) => inner + Number(match[1] ?? 0), 0)
  }, 0)

  const gizBonus = gizBonusFromAudit || gizBonusFallback

  const planCounts = {
    mensal: subscriptions.filter((item) => ['monthly', 'mensual', 'mensal'].includes(item.plan)).length,
    semestral: subscriptions.filter((item) => ['semiannual', 'semestral'].includes(item.plan)).length,
    anual: subscriptions.filter((item) => ['annual', 'anual'].includes(item.plan)).length,
    trialFree: subscriptions.filter((item) => item.status === 'trial' || item.plan === 'free').length,
  }
  const totalPlans = Math.max(teachers.length, 1)
  const planBars = [
    { label: 'Mensal', count: planCounts.mensal, pct: Math.round((planCounts.mensal / totalPlans) * 100), color: '#1c6b46' },
    { label: 'Semestral', count: planCounts.semestral, pct: Math.round((planCounts.semestral / totalPlans) * 100), color: '#2f8f5f' },
    { label: 'Anual', count: planCounts.anual, pct: Math.round((planCounts.anual / totalPlans) * 100), color: '#5fae84' },
    { label: 'Trial / Gratis', count: planCounts.trialFree, pct: Math.round((planCounts.trialFree / totalPlans) * 100), color: '#c2d8cb' },
  ]

  const recentTeachers = teachers.slice(0, 5)

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Super admin"
        title="Controle operacional"
        description="Dados reais de professoras, assinaturas, materiais, IA e privacidade."
      />

      <section className="metric-grid-v2">
        <article className="metric-card-v2">
          <div className="metric-card-v2-head"><span>Professoras</span><Users size={18} /></div>
          <strong>{teachers.length}</strong>
          <span>{paying} pagando · {trials} em trial</span>
        </article>
        <article className="metric-card-v2">
          <div className="metric-card-v2-head"><span>Assinaturas ativas</span><CreditCard size={18} /></div>
          <strong>{paying}</strong>
          <span>mensal · semestral · anual</span>
        </article>
        <article className="metric-card-v2">
          <div className="metric-card-v2-head"><span>Custo de IA (30d)</span><Bolt size={18} /></div>
          <strong>{formatCurrencyFromCents(aiCost)}</strong>
          <span>{aiLogs.length} geracoes</span>
        </article>
        <article className="metric-card-v2">
          <div className="metric-card-v2-head"><span>GizTokens liberados</span><Bolt size={18} /></div>
          <strong>{formatCompactNumber(gizBonus)}</strong>
          <span>bonus do mes atual</span>
        </article>
      </section>

      <p className="section-label-v2">Filas que precisam de voce</p>
      <section className="queue-grid-v2">
        <Link href="/verificacoes" className="queue-card-v2 queue-card-v2-warn">
          <div className="queue-card-v2-label" style={{ color: '#8a6516' }}>
            <ShieldCheck size={17} /> Verificacoes pendentes
          </div>
          <strong>{verificationsResult.count ?? 0}</strong>
          <p>Comprovantes escolares aguardando aprovacao →</p>
        </Link>
        <Link href="/materiais" className="queue-card-v2 queue-card-v2-danger">
          <div className="queue-card-v2-label" style={{ color: '#b4382f' }}>
            <AlertTriangle size={17} /> Denuncias abertas
          </div>
          <strong>{reportsResult.count ?? 0}</strong>
          <p>Materiais reportados para moderar →</p>
        </Link>
        <Link href="/assinaturas" className="queue-card-v2 queue-card-v2-warn">
          <div className="queue-card-v2-label" style={{ color: '#8a6516' }}>
            <CreditCard size={17} /> Pagamentos em atraso
          </div>
          <strong>{overdue}</strong>
          <p>Avisar ou bloquear contas →</p>
        </Link>
      </section>

      <section className="split-grid-v2">
        <article className="panel-v2">
          <div className="panel-v2-header">
            <div>
              <p className="page-eyebrow" style={{ marginBottom: 4 }}>Acesso</p>
              <h2>Professoras recentes</h2>
            </div>
            <Link href="/professoras" className="btn-primary-v2">Ver todas</Link>
          </div>
          <div className="data-table-v2-head" style={{ gridTemplateColumns: '2.2fr 1fr 1fr 1fr' }}>
            <span>Professora</span><span>Status</span><span>Turmas</span><span>IA (mes)</span>
          </div>
          {recentTeachers.map((teacher) => {
            const subscription = teacher.subscriptions?.[0]
            const status = accessStatusFromSubscription(subscription)
            return (
              <Link
                key={teacher.id}
                href={`/professoras/${teacher.id}`}
                className="data-table-v2-row data-table-v2-row-clickable"
                style={{ gridTemplateColumns: '2.2fr 1fr 1fr 1fr' }}
              >
                <span>
                  <strong>{teacher.full_name || 'Professora'}</strong>
                  <small style={{ display: 'block', color: '#8a948c', fontSize: 12 }}>{teacher.email}</small>
                </span>
                <span className={`status-chip status-chip-${status}`}>
                  {status === 'active' ? 'Pagando' : formatPlanLabel(subscription?.plan)}
                </span>
                <span>{teacher.classes?.length ?? 0}</span>
                <span>{teacher.ai_generation_logs?.length ?? 0}</span>
              </Link>
            )
          })}
        </article>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <article className="panel-v2 panel-v2-padded">
            <p className="page-eyebrow" style={{ marginBottom: 14 }}>Distribuicao de planos</p>
            <div className="plan-bars-v2">
              {planBars.map((bar) => (
                <div key={bar.label} className="plan-bar-row">
                  <div className="plan-bar-meta"><span style={{ fontWeight: 600 }}>{bar.label}</span><span>{bar.count}</span></div>
                  <div className="plan-bar-track">
                    <div className="plan-bar-fill" style={{ width: `${bar.pct}%`, background: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="dark-info-card-v2">
            <h3>GizTokens por plano</h3>
            <div className="dark-info-row"><span>Mensal</span><strong>8.000</strong></div>
            <div className="dark-info-row"><span>Semestral</span><strong>9.000</strong></div>
            <div className="dark-info-row"><span>Anual</span><strong>10.000</strong></div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#8fae9d', lineHeight: 1.5 }}>
              Bonus admin valem so no mes atual. Dia 1, o saldo volta ao plano.
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
