import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { GiztokensAdjustForm } from '../components/GiztokensAdjustForm'
import {
  accessStatusFromSubscription,
  formatNumberPt,
  formatPlanLabel,
  gizPlanLimit,
  teacherInitials,
  verificationStatusLabel,
} from '../lib/admin-utils'
import { getCurrentMonthPeriod, loadTeacherWalletsForMonth } from '../lib/giztokens-admin'
import { createSupabaseServiceClient } from '../lib/supabase-server'
import { adjustTeacherGiztokensAction } from './actions'

export const dynamic = 'force-dynamic'

type TeacherRow = {
  id: string
  full_name: string
  email: string
  subscriptions?: Array<{ status: string; plan: string; current_period_end: string | null }>
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
      subscriptions(status, plan, current_period_end),
      teacher_profile_verifications(status, updated_at),
      ai_generation_logs(id)
    `)
    .eq('role', 'teacher')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  const teachers = (data ?? []) as TeacherRow[]
  const { start: monthStart, end: monthEnd } = getCurrentMonthPeriod()
  const wallets = await loadTeacherWalletsForMonth(teachers.map((teacher) => teacher.id), monthStart)
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.full_name || 'Professora',
    email: teacher.email,
  }))

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Pessoas"
        title="Professoras"
        description="Use a busca no topo para encontrar rapido. Clique em qualquer linha para abrir a ficha completa."
      />

      <GiztokensAdjustForm
        teachers={teacherOptions}
        action={adjustTeacherGiztokensAction}
        monthLabel={`${formatMonthLabel(monthStart)} a ${formatMonthLabel(monthEnd)}`}
        returnTo="/professoras"
      />

      <article className="panel-v2">
        <div
          className="data-table-v2-head"
          style={{ gridTemplateColumns: '2.4fr 1fr 1fr 1.1fr 0.8fr 1.4fr 36px' }}
        >
          <span>Professora</span>
          <span>Plano</span>
          <span>Status</span>
          <span>Verificacao</span>
          <span>IA mes</span>
          <span>GizTokens</span>
          <span />
        </div>
        {teachers.map((teacher) => {
          const subscription = teacher.subscriptions?.[0]
          const verification = latestVerification(teacher.teacher_profile_verifications ?? [])
          const wallet = wallets.get(teacher.id)
          const status = accessStatusFromSubscription(subscription)
          const planLimit = wallet?.giztokensIncluded ?? gizPlanLimit(subscription?.plan)
          const remaining = wallet?.giztokensRemaining ?? planLimit
          const pct = planLimit > 0 ? Math.min(100, Math.round((remaining / planLimit) * 100)) : 0
          const verifStatus = verification?.status ?? 'pending'

          return (
            <Link
              key={teacher.id}
              href={`/professoras/${teacher.id}`}
              className="data-table-v2-row data-table-v2-row-clickable"
              style={{ gridTemplateColumns: '2.4fr 1fr 1fr 1.1fr 0.8fr 1.4fr 36px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span className="teacher-avatar">{teacherInitials(teacher.full_name || teacher.email)}</span>
                <span style={{ minWidth: 0 }}>
                  <strong>{teacher.full_name || 'Professora'}</strong>
                  <small style={{ display: 'block', color: '#8a948c', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teacher.email}
                  </small>
                </span>
              </span>
              <span>{formatPlanLabel(subscription?.plan)}</span>
              <span className={`status-chip status-chip-${status}`}>
                {status === 'active' ? 'Pagando' : status === 'free' ? 'Gratis' : status === 'overdue' ? 'Em atraso' : status === 'blocked' ? 'Bloqueada' : 'Trial'}
              </span>
              <span className={`status-chip status-chip-${verifStatus === 'approved' ? 'approved' : verifStatus === 'rejected' ? 'rejected' : 'pending'}`}>
                {verificationStatusLabel(verifStatus)}
              </span>
              <span>{teacher.ai_generation_logs?.length ?? 0}</span>
              <span className="giz-progress-wrap">
                <div className="giz-progress-meta">
                  <span style={{ fontWeight: 600 }}>{formatNumberPt(remaining)}</span>
                  <span>/{formatNumberPt(planLimit)}</span>
                </div>
                <div className="giz-progress-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </span>
              <ChevronRight size={16} color="#c2c7bd" />
            </Link>
          )
        })}
      </article>
    </div>
  )
}

function latestVerification(items: Array<{ status: string; updated_at: string }>) {
  return [...items].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}
