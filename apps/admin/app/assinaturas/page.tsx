import Link from 'next/link'
import { AlertTriangle, Lock, Unlock } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import {
  accessStatusFromSubscription,
  formatPlanLabel,
  teacherInitials,
} from '../lib/admin-utils'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import {
  blockAllOverdueAccess,
  blockTeacherAccess,
  liberarAcessoGratuito,
  sendAllPaymentOverdueNotices,
  sendPaymentOverdueNotice,
} from './actions'

export const dynamic = 'force-dynamic'

type TeacherSubscriptionRow = {
  id: string
  full_name: string
  email: string
  subscriptions?: Array<{
    status: string
    plan: string
    current_period_end: string | null
  }>
}

export default async function SubscriptionsPage() {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscriptions(status, plan, current_period_end)')
    .eq('role', 'teacher')
    .order('full_name', { ascending: true })
    .limit(300)

  if (error) throw new Error(error.message)
  const teachers = (data ?? []) as TeacherSubscriptionRow[]
  const classified = teachers.map((teacher) => {
    const subscription = teacher.subscriptions?.[0] ?? null
    return { teacher, subscription, access: accessStatusFromSubscription(subscription) }
  })
  const overdueTeachers = classified.filter((item) => item.access === 'overdue')

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Pessoas"
        title="Assinaturas"
        description="Centro de controle de acesso pago/gratis. O atraso nao bloqueia sozinho — a equipe decide."
      />

      <section className="metric-grid-v2">
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Pagando</span></div><strong>{classified.filter((i) => i.access === 'active').length}</strong></article>
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Acesso livre / gratis</span></div><strong>{classified.filter((i) => i.access === 'free').length}</strong></article>
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Em atraso</span></div><strong style={{ color: '#8a6516' }}>{overdueTeachers.length}</strong></article>
        <article className="metric-card-v2"><div className="metric-card-v2-head"><span>Bloqueadas</span></div><strong style={{ color: '#b4382f' }}>{classified.filter((i) => i.access === 'blocked').length}</strong></article>
      </section>

      {overdueTeachers.length > 0 && (
        <div className="banner-warn-v2">
          <AlertTriangle size={18} />
          <span>{overdueTeachers.length} conta(s) em atraso. Acoes em massa:</span>
          <div className="banner-actions">
            <form action={sendAllPaymentOverdueNotices}>
              <input type="hidden" name="returnTo" value="/assinaturas" />
              <button type="submit" className="btn-warn-v2" style={{ background: '#fff', border: '1px solid #f0dcab' }}>Avisar todas</button>
            </form>
            <form action={blockAllOverdueAccess}>
              <input type="hidden" name="returnTo" value="/assinaturas" />
              <button type="submit" className="btn-warn-v2" style={{ background: '#8a6516', color: '#fff' }}>Bloquear atrasadas</button>
            </form>
          </div>
        </div>
      )}

      <article className="panel-v2">
        <div className="data-table-v2-head" style={{ gridTemplateColumns: '2.2fr 1fr 1fr 2.2fr' }}>
          <span>Professora</span><span>Plano</span><span>Status</span><span style={{ textAlign: 'right' }}>Acoes</span>
        </div>
        {classified.map(({ teacher, subscription, access }) => (
          <div key={teacher.id} className="data-table-v2-row" style={{ gridTemplateColumns: '2.2fr 1fr 1fr 2.2fr' }}>
            <Link href={`/professoras/${teacher.id}?tab=assinatura`} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <span className="teacher-avatar">{teacherInitials(teacher.full_name || teacher.email)}</span>
              <span style={{ minWidth: 0 }}>
                <strong>{teacher.full_name || 'Professora'}</strong>
                <small style={{ display: 'block', color: '#8a948c', fontSize: 12 }}>{teacher.email}</small>
              </span>
            </Link>
            <span>{formatPlanLabel(subscription?.plan)}</span>
            <span className={`status-chip status-chip-${access}`}>
              {access === 'active' || access === 'paid_ok' ? 'Pagando' : access === 'free' ? 'Gratis' : access === 'overdue' ? 'Em atraso' : access === 'blocked' ? 'Bloqueada' : 'Trial'}
            </span>
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
              <form action={liberarAcessoGratuito}>
                <input type="hidden" name="teacherId" value={teacher.id} />
                <input type="hidden" name="returnTo" value="/assinaturas" />
                <button type="submit" className="btn-secondary-v2 btn-sm-v2"><Unlock size={13} /> Gratis</button>
              </form>
              {access === 'overdue' && (
                <form action={sendPaymentOverdueNotice}>
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <input type="hidden" name="returnTo" value="/assinaturas" />
                  <button type="submit" className="btn-warn-v2 btn-sm-v2">Avisar</button>
                </form>
              )}
              {access !== 'blocked' && (
                <form action={blockTeacherAccess}>
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <input type="hidden" name="returnTo" value="/assinaturas" />
                  <button type="submit" className="btn-danger-v2 btn-sm-v2"><Lock size={13} /> Bloquear</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </article>
    </div>
  )
}
