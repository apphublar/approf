import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createSupabaseServiceClient } from './supabase-server'
import { getOwnerReportById, updateOwnerReport } from './reports'

const SHARE_SELECT =
  'id, owner_id, class_id, coordinator_name, coordinator_email, share_token, access_status, verified_at, last_access_at, created_at, updated_at'

const DOCUMENT_SHARE_SELECT =
  'id, owner_id, report_id, coordinator_name, coordinator_email, share_token, access_status, verified_at, last_access_at, created_at, updated_at'

export async function getTeacherCoordinatorAccessPasswordStatus(ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('coordinator_access_password_hash, coordinator_access_password_updated_at')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) throw error
  return {
    configured: Boolean(data?.coordinator_access_password_hash),
    updatedAt: data?.coordinator_access_password_updated_at ?? null,
  }
}

export async function saveTeacherCoordinatorAccessPassword(ownerId: string, password: string) {
  const supabase = createSupabaseServiceClient()
  const normalized = validateCoordinatorPassword(password)
  const timestamp = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      coordinator_access_password_hash: hashCoordinatorPassword(normalized),
      coordinator_access_password_encrypted: encryptCoordinatorPassword(normalized),
      coordinator_access_password_updated_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', ownerId)
  if (error) throw error
  return { updatedAt: timestamp }
}

export async function createCoordinatorDocumentShare(input: {
  ownerId: string
  reportId: string
  coordinatorName: string
  coordinatorEmail: string
  origin: string
}) {
  const supabase = createSupabaseServiceClient()
  await requireTeacherCoordinatorPassword(input.ownerId)
  const report = await getOwnerReportById(input.ownerId, input.reportId)
  if (!report || report.status === 'archived') throw new Error('Documento não encontrado.')

  const email = normalizeEmail(input.coordinatorEmail)
  const name = input.coordinatorName.trim()
  if (!name || !email) throw new Error('Informe nome e e-mail da coordenadora.')

  const existing = await supabase
    .from('coordinator_document_shares')
    .select(DOCUMENT_SHARE_SELECT)
    .eq('owner_id', input.ownerId)
    .eq('report_id', input.reportId)
    .eq('coordinator_email', email)
    .maybeSingle()
  if (existing.error) throw existing.error

  const shareToken = existing.data?.share_token || randomBytes(24).toString('base64url')
  const { data: share, error } = await supabase
    .from('coordinator_document_shares')
    .upsert({
      owner_id: input.ownerId,
      report_id: input.reportId,
      coordinator_name: name,
      coordinator_email: email,
      share_token: shareToken,
      access_status: existing.data?.access_status === 'verified' ? 'verified' : 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,report_id,coordinator_email' })
    .select(DOCUMENT_SHARE_SELECT)
    .single()
  if (error) throw error

  const accessPassword = await getTeacherCoordinatorAccessPasswordPlaintext(input.ownerId)
  const shareUrl = `${input.origin.replace(/\/$/, '')}/coordenadora/documento/${share.share_token}`
  const teacherName = await getTeacherName(input.ownerId)
  const emailPayload = {
    to: email,
    coordinatorName: name,
    teacherName,
    password: accessPassword,
    shareUrl,
    documentTitle: formatReportTypeLabel(report.report_type),
  }
  const emailSent = await sendCoordinatorDocumentAccessEmail(emailPayload).catch((error) => {
    console.error('[coordinator/document-email] falha no envio direto', error)
    return false
  })

  await supabase.from('notification_events').insert({
    user_id: input.ownerId,
    channel: 'email',
    type: 'coordinator_document_access',
    status: emailSent ? 'sent' : 'queued',
    sent_at: emailSent ? new Date().toISOString() : null,
    payload: { ...emailPayload, password: '[redacted]' },
  })

  return { share, shareUrl }
}

export async function getCoordinatorDocumentInviteInfo(token: string) {
  const supabase = createSupabaseServiceClient()
  const share = await getCoordinatorDocumentShareByToken(token)
  if (!share) return null

  const [ownerResult, reportResult] = await Promise.all([
    supabase.from('profiles').select('full_name,email').eq('id', share.owner_id).maybeSingle(),
    supabase.from('reports').select('id,report_type,status,created_at').eq('id', share.report_id).eq('owner_id', share.owner_id).maybeSingle(),
  ])
  if (ownerResult.error) throw ownerResult.error
  if (reportResult.error) throw reportResult.error
  if (!reportResult.data || reportResult.data.status === 'archived') return null

  return {
    share,
    teacher: ownerResult.data
      ? { name: ownerResult.data.full_name, email: ownerResult.data.email }
      : null,
    report: reportResult.data,
  }
}

export async function verifyCoordinatorDocumentAccess(input: { token: string; email: string; password: string }) {
  const supabase = createSupabaseServiceClient()
  const share = await getCoordinatorDocumentShareByToken(input.token)
  if (!share) throw new Error('Link de acesso não encontrado.')
  if (normalizeEmail(input.email) !== share.coordinator_email) throw new Error('E-mail não corresponde ao convite.')

  await verifyTeacherCoordinatorPassword(share.owner_id, input.password)

  const timestamp = new Date().toISOString()
  await supabase
    .from('coordinator_document_shares')
    .update({ access_status: 'verified', verified_at: timestamp, last_access_at: timestamp, updated_at: timestamp })
    .eq('id', share.id)

  return createCoordinatorDocumentAccessToken(share.id, share.coordinator_email)
}

export async function getCoordinatorDocumentWorkspace(token: string, accessToken: string) {
  const supabase = createSupabaseServiceClient()
  const share = await requireVerifiedDocumentShare(token, accessToken)
  const report = await getOwnerReportById(share.owner_id, share.report_id)
  if (!report || report.status === 'archived') throw new Error('Documento não encontrado.')

  const [teacherResult, studentResult, classResult] = await Promise.all([
    supabase.from('profiles').select('full_name,email').eq('id', share.owner_id).maybeSingle(),
    report.student_id
      ? supabase.from('students').select('full_name').eq('id', report.student_id).eq('owner_id', share.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report.class_id
      ? supabase.from('classes').select('name,shift,age_group').eq('id', report.class_id).eq('owner_id', share.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (teacherResult.error) throw teacherResult.error
  if (studentResult.error) throw studentResult.error
  if (classResult.error) throw classResult.error

  await supabase.from('coordinator_document_shares').update({ last_access_at: new Date().toISOString() }).eq('id', share.id)

  return {
    share,
    teacher: teacherResult.data,
    report,
    student: studentResult.data,
    classData: classResult.data,
  }
}

export async function createCoordinatorShare(input: {
  ownerId: string
  classId: string
  coordinatorName: string
  coordinatorEmail: string
  origin: string
}) {
  const supabase = createSupabaseServiceClient()
  const email = normalizeEmail(input.coordinatorEmail)
  const name = input.coordinatorName.trim()
  if (!name || !email) throw new Error('Informe nome e e-mail da coordenadora.')

  const existing = await supabase
    .from('coordinator_class_shares')
    .select(SHARE_SELECT)
    .eq('owner_id', input.ownerId)
    .eq('class_id', input.classId)
    .eq('coordinator_email', email)
    .maybeSingle()

  if (existing.error) throw existing.error

  const shareToken = existing.data?.share_token || randomBytes(24).toString('base64url')
  const upsertPayload = {
    owner_id: input.ownerId,
    class_id: input.classId,
    coordinator_name: name,
    coordinator_email: email,
    share_token: shareToken,
    access_status: existing.data?.access_status === 'verified' ? 'verified' : 'pending',
    updated_at: new Date().toISOString(),
  }

  const { data: share, error } = await supabase
    .from('coordinator_class_shares')
    .upsert(upsertPayload, { onConflict: 'owner_id,class_id,coordinator_email' })
    .select(SHARE_SELECT)
    .single()
  if (error) throw error

  await requireTeacherCoordinatorPassword(input.ownerId)
  const accessPassword = await getTeacherCoordinatorAccessPasswordPlaintext(input.ownerId)
  const shareUrl = `${input.origin.replace(/\/$/, '')}/coordenadora/${share.share_token}`
  const teacherName = await getTeacherName(input.ownerId)
  const emailPayload = {
    to: email,
    coordinatorName: name,
    teacherName,
    password: accessPassword,
    shareUrl,
  }
  const emailSent = await sendCoordinatorAccessEmail(emailPayload).catch((error) => {
    console.error('[coordinator/access-email] falha no envio direto', error)
    return false
  })

  await supabase.from('notification_events').insert({
    user_id: input.ownerId,
    channel: 'email',
    type: 'coordinator_access_password',
    status: emailSent ? 'sent' : 'queued',
    sent_at: emailSent ? new Date().toISOString() : null,
    payload: { ...emailPayload, password: '[redacted]' },
  })

  await supabase.from('admin_action_logs').insert({
    actor_id: input.ownerId,
    action: 'coordinator_share_created',
    target_table: 'coordinator_class_shares',
    target_id: share.id,
    metadata: { classId: input.classId, coordinatorEmail: email },
  })

  return { share, shareUrl }
}

export async function getCoordinatorShareByToken(token: string) {
  const supabase = createSupabaseServiceClient()
  const { data: share, error } = await supabase
    .from('coordinator_class_shares')
    .select(SHARE_SELECT)
    .eq('share_token', token)
    .neq('access_status', 'revoked')
    .maybeSingle()
  if (error) throw error
  return share
}

export async function getCoordinatorInviteInfo(token: string) {
  const supabase = createSupabaseServiceClient()
  const share = await getCoordinatorShareByToken(token)
  if (!share) return null

  const [ownerResult, countResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name,email')
      .eq('id', share.owner_id)
      .maybeSingle(),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', share.class_id),
  ])

  if (ownerResult.error) throw ownerResult.error
  if (countResult.error) throw countResult.error

  return {
    share,
    teacher: ownerResult.data
      ? {
          name: ownerResult.data.full_name,
          email: ownerResult.data.email,
        }
      : null,
    studentCount: countResult.count ?? 0,
  }
}

export async function verifyCoordinatorAccess(input: { token: string; email: string; password: string }) {
  const supabase = createSupabaseServiceClient()
  const share = await getCoordinatorShareByToken(input.token)
  if (!share) throw new Error('Link de acesso não encontrado.')
  if (normalizeEmail(input.email) !== share.coordinator_email) throw new Error('E-mail não corresponde ao convite.')

  await verifyTeacherCoordinatorPassword(share.owner_id, input.password)

  const timestamp = new Date().toISOString()
  await supabase
    .from('coordinator_class_shares')
    .update({ access_status: 'verified', verified_at: timestamp, last_access_at: timestamp, updated_at: timestamp })
    .eq('id', share.id)

  return createCoordinatorAccessToken(share.id, share.coordinator_email)
}

export async function getCoordinatorWorkspace(token: string, accessToken: string) {
  const supabase = createSupabaseServiceClient()
  const share = await requireVerifiedShare(token, accessToken, { allowFinalized: true })

  const [classResult, studentsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id,name,shift,age_group,school_id')
      .eq('id', share.class_id)
      .eq('owner_id', share.owner_id)
      .is('archived_at', null)
      .maybeSingle(),
    supabase
      .from('students')
      .select('id,full_name,birth_date,support_tags,created_at')
      .eq('owner_id', share.owner_id)
      .eq('class_id', share.class_id)
      .is('archived_at', null)
      .order('full_name'),
  ])

  if (classResult.error) throw classResult.error
  if (studentsResult.error) throw studentsResult.error
  if (!classResult.data) throw new Error('Turma nÃ£o encontrada para este convite.')

  const studentIds = (studentsResult.data ?? []).map((student) => student.id)
  const reportsQuery = supabase
    .from('reports')
    .select('id,student_id,class_id,status,report_type,body,is_final_version,coordinator_review_status,coordinator_review_notes,coordinator_reviewed_by,coordinator_reviewed_at,created_at,updated_at')
    .eq('owner_id', share.owner_id)
    .eq('class_id', share.class_id)
    .eq('report_type', 'development_report')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  const eventsQuery = supabase
    .from('report_review_events')
    .select('id,report_id,student_id,actor_type,actor_name,actor_email,action,notes,previous_status,next_status,created_at')
    .eq('owner_id', share.owner_id)
    .eq('class_id', share.class_id)
    .order('created_at', { ascending: false })
    .limit(200)

  const [reportsResult, eventsResult] = await Promise.all([
    studentIds.length
      ? reportsQuery.in('student_id', studentIds)
      : reportsQuery.is('student_id', null).limit(0),
    studentIds.length
      ? eventsQuery.or(`student_id.is.null,student_id.in.(${studentIds.join(',')})`)
      : eventsQuery.is('student_id', null),
  ])

  if (reportsResult.error) throw reportsResult.error
  if (eventsResult.error) throw eventsResult.error

  await supabase.from('coordinator_class_shares').update({ last_access_at: new Date().toISOString() }).eq('id', share.id)
  return {
    share,
    classData: classResult.data,
    students: (studentsResult.data ?? []).map((student) => ({
      ...student,
      tag: Array.isArray(student.support_tags) && student.support_tags.length ? student.support_tags.join(', ') : null,
    })),
    reports: reportsResult.data ?? [],
    events: eventsResult.data ?? [],
  }
}

export async function updateCoordinatorReport(input: {
  token: string
  accessToken: string
  reportId: string
  body?: string
  notes?: string
  action: 'comment' | 'request_changes' | 'approve'
}) {
  const supabase = createSupabaseServiceClient()
  const share = await requireVerifiedShare(input.token, input.accessToken)
  const report = await getOwnerReportById(share.owner_id, input.reportId)
  if (!report || report.class_id !== share.class_id || report.report_type !== 'development_report') {
    throw new Error('Relatório não encontrado para esta turma.')
  }

  const previousStatus = String(report.coordinator_review_status ?? 'pending')
  const nextStatus = input.action === 'approve'
    ? 'approved'
    : input.action === 'request_changes'
      ? 'changes_requested'
      : previousStatus

  const updated = await updateOwnerReport({
    ownerId: share.owner_id,
    reportId: input.reportId,
    body: input.body,
    coordinatorReviewStatus: nextStatus,
    coordinatorReviewNotes: input.notes ?? null,
    coordinatorReviewedBy: `${share.coordinator_name} <${share.coordinator_email}>`,
    isFinalVersion: input.action === 'approve' ? true : undefined,
  })

  await supabase.from('report_review_events').insert({
    report_id: input.reportId,
    owner_id: share.owner_id,
    class_id: share.class_id,
    student_id: report.student_id,
    actor_type: 'coordinator',
    actor_name: share.coordinator_name,
    actor_email: share.coordinator_email,
    action: input.action,
    notes: input.notes ?? null,
    previous_status: previousStatus,
    next_status: nextStatus,
  })

  return updated
}

export async function finalizeCoordinatorReview(token: string, accessToken: string) {
  const supabase = createSupabaseServiceClient()
  const share = await requireVerifiedShare(token, accessToken)

  const [reportsResult] = await Promise.all([
    supabase
      .from('reports')
      .select('id,student_id,coordinator_review_status')
      .eq('owner_id', share.owner_id)
      .eq('class_id', share.class_id)
      .eq('report_type', 'development_report')
      .neq('status', 'archived'),
  ])

  const reports = reportsResult.data ?? []
  const approved = reports.filter((r) => r.coordinator_review_status === 'approved').length
  const changesRequested = reports.filter((r) => r.coordinator_review_status === 'changes_requested').length

  const timestamp = new Date().toISOString()
  await supabase
    .from('coordinator_class_shares')
    .update({ access_status: 'review_finalized', last_access_at: timestamp, updated_at: timestamp })
    .eq('id', share.id)

  await supabase.from('report_review_events').insert({
    report_id: null,
    owner_id: share.owner_id,
    class_id: share.class_id,
    student_id: null,
    actor_type: 'coordinator',
    actor_name: share.coordinator_name,
    actor_email: share.coordinator_email,
    action: 'finalize',
    notes: `Revisão finalizada: ${approved} aprovado(s), ${changesRequested} com correção solicitada.`,
    previous_status: null,
    next_status: 'review_finalized',
  })

  await supabase.from('admin_action_logs').insert({
    actor_id: share.owner_id,
    action: 'coordinator_review_finalized',
    target_table: 'coordinator_class_shares',
    target_id: share.id,
    metadata: { classId: share.class_id, coordinatorEmail: share.coordinator_email, approved, changesRequested },
  })

  return { approved, changesRequested, total: reports.length }
}

async function requireVerifiedShare(token: string, accessToken: string, options?: { allowFinalized?: boolean }) {
  const share = await getCoordinatorShareByToken(token)
  if (!share) throw new Error('Link de acesso não encontrado.')
  const isAllowedStatus = share.access_status === 'verified' || (options?.allowFinalized && share.access_status === 'review_finalized')
  if (!isAllowedStatus) throw new Error('Acesso ainda não validado.')
  if (!isValidCoordinatorAccessToken(accessToken, share.id, share.coordinator_email)) {
    throw new Error('Acesso expirado. Valide a senha novamente.')
  }
  return share
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function validateCoordinatorPassword(password: string) {
  const normalized = password.trim()
  if (!/^[A-Za-z0-9]{6}$/.test(normalized)) {
    throw new Error('A senha deve ter exatamente 6 caracteres entre letras e números.')
  }
  return normalized
}

function hashCoordinatorPassword(password: string) {
  return createHmac('sha256', getCoordinatorSecret()).update(validateCoordinatorPassword(password)).digest('hex')
}

function encryptCoordinatorPassword(password: string) {
  const normalized = validateCoordinatorPassword(password)
  const key = createHash('sha256').update(`${getCoordinatorSecret()}:password-encrypt`).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

function decryptCoordinatorPassword(encrypted: string) {
  const buffer = Buffer.from(encrypted, 'base64url')
  const iv = buffer.subarray(0, 12)
  const authTag = buffer.subarray(12, 28)
  const data = buffer.subarray(28)
  const key = createHash('sha256').update(`${getCoordinatorSecret()}:password-encrypt`).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

async function requireTeacherCoordinatorPassword(ownerId: string) {
  const status = await getTeacherCoordinatorAccessPasswordStatus(ownerId)
  if (!status.configured) {
    throw new Error('Configure a senha de acesso da coordenadora no Criador Pedagógico antes de compartilhar.')
  }
}

async function verifyTeacherCoordinatorPassword(ownerId: string, password: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('coordinator_access_password_hash')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) throw error
  if (!data?.coordinator_access_password_hash) {
    throw new Error('A professora ainda não configurou a senha de acesso da coordenadora.')
  }
  if (!safeEqual(data.coordinator_access_password_hash, hashCoordinatorPassword(password))) {
    throw new Error('Senha de acesso inválida.')
  }
}

async function getTeacherCoordinatorAccessPasswordPlaintext(ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('coordinator_access_password_encrypted')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) throw error
  if (!data?.coordinator_access_password_encrypted) {
    throw new Error('Configure a senha de acesso da coordenadora no Criador Pedagógico antes de compartilhar.')
  }
  return decryptCoordinatorPassword(data.coordinator_access_password_encrypted)
}

async function getTeacherName(ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('profiles').select('full_name').eq('id', ownerId).maybeSingle()
  return data?.full_name?.trim() || 'Professora'
}

async function getCoordinatorDocumentShareByToken(token: string) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('coordinator_document_shares')
    .select(DOCUMENT_SHARE_SELECT)
    .eq('share_token', token)
    .neq('access_status', 'revoked')
    .maybeSingle()
  if (error) throw error
  return data
}

async function requireVerifiedDocumentShare(token: string, accessToken: string) {
  const share = await getCoordinatorDocumentShareByToken(token)
  if (!share) throw new Error('Link de acesso não encontrado.')
  if (share.access_status !== 'verified') throw new Error('Acesso ainda não validado.')
  if (!isValidCoordinatorDocumentAccessToken(accessToken, share.id, share.coordinator_email)) {
    throw new Error('Acesso expirado. Valide a senha novamente.')
  }
  return share
}

function createCoordinatorDocumentAccessToken(shareId: string, email: string) {
  const payload = `doc:${shareId}:${email}`
  const signature = createHmac('sha256', getCoordinatorSecret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

function isValidCoordinatorDocumentAccessToken(token: string, shareId: string, email: string) {
  const [payloadEncoded, signature] = token.split('.')
  if (!payloadEncoded || !signature) return false
  const payload = Buffer.from(payloadEncoded, 'base64url').toString('utf8')
  if (payload !== `doc:${shareId}:${email}`) return false
  const expected = createHmac('sha256', getCoordinatorSecret()).update(payload).digest('base64url')
  return safeEqual(signature, expected)
}

function formatReportTypeLabel(type: string) {
  switch (type) {
    case 'development_report': return 'Relatório de desenvolvimento'
    case 'class_diary': return 'Diário de bordo'
    case 'weekly_planning': return 'Planejamento semanal'
    case 'daily_lesson_plan': return 'Plano de aula diário'
    case 'pedagogical_project': return 'Projeto pedagógico'
    case 'portfolio_text':
    case 'portfolio_image': return 'Portfólio pedagógico'
    case 'generated_image': return 'Imagem pedagógica'
    case 'specialist_referral':
    case 'specialist_report': return 'Relatório para especialista'
    case 'parents_meeting_record': return 'Reunião de pais'
    case 'general_report': return 'Relatório pedagógico'
    default: return 'Documento pedagógico'
  }
}


function createCoordinatorAccessToken(shareId: string, email: string) {
  const payload = `${shareId}:${email}`
  const signature = createHmac('sha256', getCoordinatorSecret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

function isValidCoordinatorAccessToken(token: string, shareId: string, email: string) {
  const [payloadEncoded, signature] = token.split('.')
  if (!payloadEncoded || !signature) return false
  const payload = Buffer.from(payloadEncoded, 'base64url').toString('utf8')
  if (payload !== `${shareId}:${email}`) return false
  const expected = createHmac('sha256', getCoordinatorSecret()).update(payload).digest('base64url')
  return safeEqual(signature, expected)
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function getCoordinatorSecret() {
  return process.env.COORDINATOR_ACCESS_SECRET || process.env.REPORT_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'approf-local-coordinator-secret'
}

async function sendCoordinatorAccessEmail(input: {
  to: string
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return false

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Approf <noreply@approf.com.br>'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: 'Acesso aos relatórios da turma',
      html: buildCoordinatorAccessEmailHtml(input),
      text: buildCoordinatorAccessEmailText(input),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Falha ao enviar e-mail pelo Resend.')
  }

  return true
}

function buildCoordinatorAccessEmailHtml(input: {
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1A1A1A">
      <h1 style="color:#123D2C">Acesso aos relatórios da turma</h1>
      <p>Olá, ${escapeHtml(input.coordinatorName)}.</p>
      <p>${escapeHtml(input.teacherName)} compartilhou com você os relatórios de desenvolvimento da turma para revisão pedagógica.</p>
      <p>Use a senha de acesso abaixo junto com o seu e-mail:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;color:#123D2C">${escapeHtml(input.password)}</p>
      <p><a href="${input.shareUrl}" style="display:inline-block;background:#3E7A3F;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Acessar relatórios</a></p>
      <p style="font-size:13px;color:#666">A professora pode atualizar essa senha a qualquer momento no Criador Pedagógico.</p>
    </div>
  `
}

function buildCoordinatorAccessEmailText(input: {
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
}) {
  return [
    `Olá, ${input.coordinatorName}.`,
    '',
    `${input.teacherName} compartilhou com você os relatórios de desenvolvimento da turma para revisão pedagógica.`,
    '',
    `Senha de acesso: ${input.password}`,
    `Link: ${input.shareUrl}`,
    '',
    'A professora pode atualizar essa senha a qualquer momento no Criador Pedagógico.',
  ].join('\n')
}

async function sendCoordinatorDocumentAccessEmail(input: {
  to: string
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
  documentTitle: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return false

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Approf <noreply@approf.com.br>'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: `Acesso ao documento: ${input.documentTitle}`,
      html: buildCoordinatorDocumentAccessEmailHtml(input),
      text: buildCoordinatorDocumentAccessEmailText(input),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Falha ao enviar e-mail pelo Resend.')
  }

  return true
}

function buildCoordinatorDocumentAccessEmailHtml(input: {
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
  documentTitle: string
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1A1A1A">
      <h1 style="color:#123D2C">Acesso a documento pedagógico</h1>
      <p>Olá, ${escapeHtml(input.coordinatorName)}.</p>
      <p>${escapeHtml(input.teacherName)} compartilhou com você o documento <strong>${escapeHtml(input.documentTitle)}</strong>.</p>
      <p>Use a senha de acesso abaixo junto com o seu e-mail:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;color:#123D2C">${escapeHtml(input.password)}</p>
      <p><a href="${input.shareUrl}" style="display:inline-block;background:#3E7A3F;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Abrir documento</a></p>
      <p style="font-size:13px;color:#666">A professora pode atualizar essa senha a qualquer momento no Criador Pedagógico.</p>
    </div>
  `
}

function buildCoordinatorDocumentAccessEmailText(input: {
  coordinatorName: string
  teacherName: string
  password: string
  shareUrl: string
  documentTitle: string
}) {
  return [
    `Olá, ${input.coordinatorName}.`,
    '',
    `${input.teacherName} compartilhou com você o documento ${input.documentTitle}.`,
    '',
    `Senha de acesso: ${input.password}`,
    `Link: ${input.shareUrl}`,
    '',
    'A professora pode atualizar essa senha a qualquer momento no Criador Pedagógico.',
  ].join('\n')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
