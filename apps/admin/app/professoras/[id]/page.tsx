import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createSupabaseServiceClient } from '../../lib/supabase-server'
import { getCurrentMonthPeriod, loadTeacherWalletsForMonth } from '../../lib/giztokens-admin'
import { listTeacherVerificationRequests } from '../../lib/account'
import { TeacherDetailClient } from './TeacherDetailClient'

export const dynamic = 'force-dynamic'

export default async function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createSupabaseServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { start: monthStart } = getCurrentMonthPeriod()

  const [profileResult, aiResult, auditResult, verificationRequests] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        subscriptions(id, status, plan, provider, external_reference, trial_expires_at, current_period_end, notes),
        schools(id, name, city, state),
        teacher_profile_verifications(id, status, notes, documents, updated_at, created_at),
        classes(id),
        students(id)
      `)
      .eq('id', id)
      .eq('role', 'teacher')
      .maybeSingle(),
    supabase
      .from('ai_generation_logs')
      .select('id, status, actual_cost_cents, estimated_cost_cents, created_at')
      .eq('owner_id', id)
      .gte('created_at', since.toISOString()),
    supabase
      .from('admin_action_logs')
      .select('id, action, metadata, created_at, actor:profiles!actor_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(200),
    listTeacherVerificationRequests(),
  ])

  if (profileResult.error) throw new Error(profileResult.error.message)
  if (!profileResult.data) notFound()

  const teacher = profileResult.data
  const wallets = await loadTeacherWalletsForMonth([id], monthStart)
  const wallet = wallets.get(id)
  const aiLogs = aiResult.data ?? []
  const aiCost = aiLogs.reduce((sum, item) => sum + Number(item.actual_cost_cents || item.estimated_cost_cents || 0), 0)
  const monthAiCount = aiLogs.length

  const teacherName = teacher.full_name || 'Professora'
  const activity = (auditResult.data ?? [])
    .filter((log) => logTargetsTeacher(log, id, teacherName, teacher.email))
    .slice(0, 20)
    .map((log) => ({
      id: log.id,
      action: formatAuditAction(String(log.action)),
      detail: formatAuditDetail(log.metadata as Record<string, unknown>),
      when: log.created_at,
      actor: (log.actor as { full_name?: string } | null)?.full_name ?? 'Sistema',
    }))

  const verificationForTeacher = verificationRequests.find((item) => item.ownerId === id) ?? null
  const verificationPayload = verificationForTeacher
    ? {
        id: verificationForTeacher.id,
        documents: verificationForTeacher.documents
          .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
          .map((doc) => ({ fileName: doc.fileName, signedUrl: doc.signedUrl })),
      }
    : null
  const schools = teacher.schools ?? []
  const schoolLabel = schools[0]?.name ?? 'Sem escola informada'

  return (
    <Suspense fallback={null}>
      <TeacherDetailClient
      teacher={{
        id: teacher.id,
        name: teacherName,
        email: teacher.email,
        phone: teacher.phone,
        schoolLabel,
        subscription: teacher.subscriptions?.[0] ?? null,
        verificationStatus: latestVerification(teacher.teacher_profile_verifications ?? [])?.status ?? 'pending',
      }}
      stats={{
        classes: teacher.classes?.length ?? 0,
        students: teacher.students?.length ?? 0,
        generations30d: monthAiCount,
        aiCostCents: aiCost,
        gizRemaining: wallet?.giztokensRemaining ?? 0,
        gizIncluded: wallet?.giztokensIncluded ?? 0,
      }}
      verification={verificationPayload}
      activity={activity}
      teacherOptions={[{ id: teacher.id, name: teacherName, email: teacher.email }]}
      monthStart={monthStart}
      />
    </Suspense>
  )
}

function latestVerification(items: Array<{ status: string; updated_at?: string; created_at?: string }>) {
  return [...items].sort((a, b) => (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? ''))[0] ?? null
}

function logTargetsTeacher(log: { metadata?: unknown; target_id?: string | null }, teacherId: string, teacherName: string, teacherEmail: string) {
  const meta = (log.metadata ?? {}) as Record<string, unknown>
  if (log.target_id === teacherId) return true
  if (meta.teacherId === teacherId) return true
  if (meta.teacherEmail === teacherEmail) return true
  if (typeof meta.teacherName === 'string' && meta.teacherName === teacherName) return true
  if (Array.isArray(meta.teacherIds) && meta.teacherIds.includes(teacherId)) return true
  return false
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    teacher_subscription_updated: 'Plano atualizado',
    teacher_access_granted_free: 'Acesso gratuito liberado',
    teacher_giztokens_adjusted: 'GizTokens ajustados',
    teacher_payment_overdue_notice_sent: 'Aviso de atraso enviado',
    teacher_access_blocked_manual: 'Conta bloqueada',
    verification_approved: 'Verificacao aprovada',
    verification_rejected: 'Verificacao rejeitada',
    teacher_verification_updated: 'Verificacao atualizada',
    material_status_updated: 'Material moderado',
    app_announcement_sent: 'Aviso enviado ao app',
  }
  return labels[action] ?? action
}

function formatAuditDetail(meta: Record<string, unknown>) {
  if (typeof meta.reason === 'string' && meta.reason) return meta.reason
  if (typeof meta.amount === 'number') {
    const mode = meta.mode === 'set_minimum' ? 'minimo' : `+${meta.amount}`
    return `${mode} Giz`
  }
  if (typeof meta.plan === 'string') return `Plano ${meta.plan}`
  return 'Acao registrada pela equipe'
}
