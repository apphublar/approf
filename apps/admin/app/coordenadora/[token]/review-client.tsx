'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Student = { id: string; full_name: string; birth_date: string | null; tag: string | null }
type Report = {
  id: string
  student_id: string | null
  body: string | null
  coordinator_review_status: string | null
  coordinator_review_notes: string | null
  created_at: string
  updated_at: string
}
type ReviewEvent = {
  id: string
  report_id: string
  student_id: string | null
  actor_name: string | null
  action: string
  notes: string | null
  next_status: string | null
  created_at: string
}
type Workspace = {
  share: { coordinator_name: string; coordinator_email: string; access_status: string }
  classData: { name: string; shift: string; age_group: string } | null
  students: Student[]
  reports: Report[]
  events: ReviewEvent[]
}
type InviteInfo = {
  coordinatorName: string
  coordinatorEmail: string
  accessStatus: string
  teacher: { name: string; email: string } | null
  studentCount: number
}

type ReviewAction = 'comment' | 'request_changes' | 'approve'

export default function CoordinatorReviewClient({ token }: { token: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedReportId, setSelectedReportId] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [notes, setNotes] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [finalized, setFinalized] = useState(false)
  const reportEditorRef = useRef<HTMLDivElement | null>(null)
  const storageKey = `approf:coordinator:${token}`

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) setAccessToken(saved)
  }, [storageKey])

  useEffect(() => {
    loadInviteInfo()
  }, [token])

  useEffect(() => {
    if (!accessToken) return
    loadWorkspace(accessToken)
  }, [accessToken])

  const students = workspace?.students ?? []
  const reports = workspace?.reports ?? []
  const events = workspace?.events ?? []
  const coordinatorName = workspace?.share?.coordinator_name ?? ''
  const className = workspace?.classData?.name ?? 'Turma compartilhada'

  const reportsByStudent = useMemo(() => {
    const map = new Map<string, Report[]>()
    reports.forEach((report) => {
      if (!report.student_id) return
      map.set(report.student_id, [...(map.get(report.student_id) ?? []), report])
    })
    return map
  }, [reports])

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? students[0]
  const selectedReports = selectedStudent ? reportsByStudent.get(selectedStudent.id) ?? [] : []
  const selectedReport = selectedReports.find((r) => r.id === selectedReportId) ?? selectedReports[0]
  const selectedEvents = selectedReport ? events.filter((e) => e.report_id === selectedReport.id) : []

  useEffect(() => {
    if (!selectedStudent && students[0]) setSelectedStudentId(students[0].id)
  }, [selectedStudent, students])

  useEffect(() => {
    if (!selectedReport && selectedReports[0]) setSelectedReportId(selectedReports[0].id)
  }, [selectedReport, selectedReports])

  useEffect(() => {
    setEditedBody(normalizeReportHtml(selectedReport?.body ?? ''))
    setNotes('')
    setActionMessage('')
    setError('')
  }, [selectedReport?.id])

  const reviewedCount = useMemo(() => {
    return students.filter((student) => {
      const studentReports = reportsByStudent.get(student.id) ?? []
      return studentReports.some((r) => r.coordinator_review_status && r.coordinator_review_status !== 'pending')
    }).length
  }, [students, reportsByStudent])

  const canFinalize = reviewedCount > 0 && students.length > 0
  const isReviewFinalized = finalized || workspace?.share?.access_status === 'review_finalized'

  async function loadInviteInfo() {
    try {
      const response = await fetch(`/api/coordinator/public/verify?token=${encodeURIComponent(token)}`)
      const payload = await response.json()
      if (!response.ok) return
      setInviteInfo(payload.share as InviteInfo)
      if (payload.share?.coordinatorEmail) setEmail(payload.share.coordinatorEmail)
    } catch {
      // Convite ainda pode ser validado manualmente.
    }
  }

  async function verify() {
    if (!email.trim() || !password.trim()) {
      setError('Informe o e-mail e a senha de acesso.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/coordinator/public/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim(), password: password.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Não foi possível validar o acesso.')
        return
      }
      window.localStorage.setItem(storageKey, payload.accessToken)
      setAccessToken(payload.accessToken)
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspace(nextAccessToken = accessToken) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/coordinator/public/workspace?token=${encodeURIComponent(token)}`, {
        headers: { 'x-coordinator-access': nextAccessToken },
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Acesso não validado. Verifique a senha.')
        window.localStorage.removeItem(storageKey)
        setAccessToken('')
        return
      }
      setWorkspace(payload as Workspace)
    } finally {
      setLoading(false)
    }
  }

  async function submitReview(action: ReviewAction) {
    if (!selectedReport) return
    setError('')
    setActionMessage('')
    setSubmitting(true)
    try {
      const currentBody = reportEditorRef.current?.innerHTML ?? editedBody
      const response = await fetch(`/api/coordinator/public/reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-coordinator-access': accessToken },
        body: JSON.stringify({ token, action, notes: notes.trim() || undefined, body: currentBody }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Não foi possível salvar a revisão.')
        return
      }
      const messages: Record<ReviewAction, string> = {
        approve: 'Relatório aprovado com sucesso.',
        request_changes: 'Solicitação de correção registrada.',
        comment: 'Observação registrada.',
      }
      setActionMessage(messages[action])
      setEditedBody(currentBody)
      await loadWorkspace()
    } finally {
      setSubmitting(false)
    }
  }

  function applyReportCommand(command: 'bold' | 'italic' | 'underline' | 'removeFormat') {
    reportEditorRef.current?.focus()
    document.execCommand(command)
    setEditedBody(reportEditorRef.current?.innerHTML ?? editedBody)
  }

  function applyReportHighlight(color: string) {
    reportEditorRef.current?.focus()
    document.execCommand('backColor', false, color)
    setEditedBody(reportEditorRef.current?.innerHTML ?? editedBody)
  }

  async function finalize() {
    if (!canFinalize) return
    setFinalizing(true)
    setError('')
    try {
      const response = await fetch('/api/coordinator/public/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-coordinator-access': accessToken },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Não foi possível finalizar a revisão.')
        return
      }
      setFinalized(true)
    } finally {
      setFinalizing(false)
    }
  }

  const css = `
    .admin-shell { display: block !important; background: #F2F7F2 !important; }
    .admin-shell .sidebar { display: none !important; }
    .admin-shell .workspace { max-width: none !important; padding: 0 !important; }
    *, *::before, *::after { box-sizing: border-box; }
    .cr-page { min-height: 100vh; background: #F2F7F2; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1A2B20; }
    .cr-center { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .cr-login { background: #fff; border: 1px solid #D0E8C8; border-radius: 20px; box-shadow: 0 16px 48px rgba(27,67,50,.10); padding: 40px; width: 100%; max-width: 440px; }
    .cr-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .cr-brand-mark { width: 44px; height: 44px; background: #1B4332; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 800; }
    .cr-brand-text strong { display: block; font-size: 17px; font-weight: 800; color: #1B4332; }
    .cr-brand-text small { font-size: 12px; color: #6E8C78; }
    .cr-login h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
    .cr-login p { font-size: 14px; color: #5A7060; margin: 0 0 24px; line-height: 1.55; }
    .cr-invite-info { border: 1px solid #D0E8C8; background: #F8FBF7; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; }
    .cr-invite-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 13px; color: #5A7060; }
    .cr-invite-row strong { color: #1A2B20; text-align: right; }
    .cr-input { width: 100%; border: 1px solid #C8DEC0; border-radius: 10px; padding: 13px 14px; font-size: 14px; color: #1A2B20; background: #F8FBF7; outline: none; margin-bottom: 10px; }
    .cr-input:focus { border-color: #3E7A3F; background: #fff; }
    .cr-btn { width: 100%; padding: 14px; border-radius: 10px; border: none; background: #1B4332; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 4px; }
    .cr-btn:hover { background: #276246; }
    .cr-btn:disabled { opacity: 0.5; cursor: default; }
    .cr-error { color: #A33A20; background: #FFF1EC; border: 1px solid #F9C9B8; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 10px; }
    .cr-success { color: #1B6B3C; background: #EAF7EE; border: 1px solid #B6DECA; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 10px; }
    .cr-workspace { display: flex; flex-direction: column; min-height: 100vh; }
    .cr-topbar { background: #1B4332; color: #fff; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .cr-topbar-brand { display: flex; align-items: center; gap: 12px; }
    .cr-topbar-mark { width: 36px; height: 36px; background: rgba(255,255,255,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; }
    .cr-topbar-info strong { display: block; font-size: 15px; font-weight: 800; }
    .cr-topbar-info small { font-size: 12px; color: rgba(255,255,255,0.65); }
    .cr-progress { background: rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 16px; font-size: 13px; text-align: right; }
    .cr-progress strong { display: block; font-size: 22px; font-weight: 800; line-height: 1; }
    .cr-progress span { color: rgba(255,255,255,0.7); }
    .cr-body { display: grid; grid-template-columns: 280px 1fr; flex: 1; }
    .cr-sidebar { background: #fff; border-right: 1px solid #D0E8C8; padding: 16px; overflow-y: auto; }
    .cr-sidebar h2 { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6E8C78; margin: 0 0 12px; }
    .cr-student-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: transparent; cursor: pointer; text-align: left; margin-bottom: 6px; }
    .cr-student-btn:hover { background: #F0F9F0; }
    .cr-student-btn.active { background: #EAF5E8; border-color: #B6D9AA; }
    .cr-student-name { font-size: 13px; font-weight: 700; color: #1A2B20; display: block; }
    .cr-student-sub { font-size: 11px; color: #6E8C78; display: block; margin-top: 2px; }
    .cr-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
    .cr-badge.approved { background: #DCF5E0; color: #1B6B3C; }
    .cr-badge.changes { background: #FFF3DB; color: #7A5000; }
    .cr-badge.pending { background: #F0F0F0; color: #6E7C70; }
    .cr-badge.no-report { background: #F5E8E8; color: #7A3020; }
    .cr-main { padding: 28px; overflow-y: auto; }
    .cr-card { background: #fff; border: 1px solid #D0E8C8; border-radius: 16px; padding: 24px; margin-bottom: 20px; }
    .cr-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .cr-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6E8C78; margin: 0 0 4px; }
    .cr-card h2 { font-size: 18px; font-weight: 800; margin: 0; }
    .cr-select { width: 100%; border: 1px solid #C8DEC0; border-radius: 8px; padding: 10px 12px; font-size: 13px; background: #F8FBF7; color: #1A2B20; outline: none; margin-bottom: 14px; }
    .cr-editor-wrap { position: relative; }
    .cr-editor-toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border: 1px solid #C8DEC0; border-bottom: none; border-radius: 10px 10px 0 0; padding: 8px 10px; background: rgba(248, 251, 247, 0.96); backdrop-filter: blur(8px); box-shadow: 0 8px 18px rgba(27, 67, 50, 0.08); }
    .cr-tool-btn { border: 1px solid #D0E8C8; background: #fff; color: #1A2B20; border-radius: 8px; min-width: 34px; height: 32px; padding: 0 10px; font-size: 12px; font-weight: 800; cursor: pointer; }
    .cr-tool-btn:hover { border-color: #3E7A3F; }
    .cr-color-btn { width: 28px; height: 28px; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px #C8DEC0; cursor: pointer; }
    .cr-document-editor { width: 100%; min-height: 360px; border: 1px solid #C8DEC0; border-radius: 0 0 10px 10px; padding: 24px 28px; font-size: 15px; line-height: 1.8; background: #fff; color: #1A2B20; outline: none; font-family: Georgia, 'Times New Roman', serif; }
    .cr-document-editor:focus { border-color: #3E7A3F; }
    .cr-document-editor p { margin: 0 0 14px; }
    .cr-document-editor p:last-child { margin-bottom: 0; }
    .cr-document-editor b, .cr-document-editor strong { font-weight: 800; color: #0F261D; }
    .cr-document-editor h1, .cr-document-editor h2, .cr-document-editor h3 { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1B4332; margin: 18px 0 10px; line-height: 1.25; }
    .cr-editor-hint { font-size: 11px; color: #6E8C78; margin: 8px 0 0; line-height: 1.4; }
    .cr-notes-area { width: 100%; min-height: 80px; border: 1px solid #C8DEC0; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.6; background: #FAFCF9; color: #1A2B20; resize: vertical; outline: none; font-family: inherit; margin-top: 12px; }
    .cr-notes-area:focus { border-color: #3E7A3F; background: #fff; }
    .cr-section-label { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #6E8C78; margin: 16px 0 6px; display: block; }
    .cr-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .cr-action-btn { flex: 1; min-width: 120px; padding: 12px 16px; border-radius: 10px; border: 1px solid; font-size: 13px; font-weight: 700; cursor: pointer; }
    .cr-action-btn:disabled { opacity: 0.5; cursor: default; }
    .cr-action-btn.comment { background: #F0F9F0; color: #1B4332; border-color: #B6D9AA; }
    .cr-action-btn.request { background: #FFF3DB; color: #7A5000; border-color: #F5D990; }
    .cr-action-btn.approve { background: #1B4332; color: #fff; border-color: #1B4332; }
    .cr-action-btn.approve:hover:not(:disabled) { background: #276246; }
    .cr-history { border-top: 1px solid #E4F0DC; margin-top: 20px; padding-top: 16px; }
    .cr-history h3 { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #6E8C78; margin: 0 0 12px; }
    .cr-event { padding: 10px 12px; border-radius: 8px; border: 1px solid #E4F0DC; background: #F8FBF7; margin-bottom: 8px; }
    .cr-event-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .cr-event-header strong { font-size: 12px; color: #1A2B20; }
    .cr-event-header span { font-size: 11px; color: #6E8C78; }
    .cr-event p { font-size: 12px; color: #5A7060; margin: 0; line-height: 1.5; }
    .cr-empty { text-align: center; padding: 40px 20px; color: #6E8C78; font-size: 14px; }
    .cr-empty strong { display: block; font-size: 16px; color: #1A2B20; margin-bottom: 8px; }
    .cr-finalize-bar { background: #fff; border-top: 1px solid #D0E8C8; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .cr-finalize-info { font-size: 13px; color: #5A7060; }
    .cr-finalize-info strong { display: block; font-size: 14px; color: #1A2B20; margin-bottom: 2px; }
    .cr-finalize-btn { padding: 12px 28px; border-radius: 10px; border: none; background: #276246; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; }
    .cr-finalize-btn:hover:not(:disabled) { background: #1B4332; }
    .cr-finalize-btn:disabled { opacity: 0.5; cursor: default; }
    .cr-finalized { background: #EAF7EE; border: 1px solid #B6DECA; border-radius: 16px; padding: 32px; text-align: center; max-width: 520px; margin: 40px auto; }
    .cr-finalized h2 { font-size: 22px; font-weight: 800; color: #1B4332; margin: 0 0 10px; }
    .cr-finalized p { font-size: 14px; color: #3D6A4E; margin: 0; line-height: 1.6; }
    @media (max-width: 720px) {
      .cr-body { grid-template-columns: 1fr; }
      .cr-sidebar { border-right: none; border-bottom: 1px solid #D0E8C8; }
    }
  `

  if (!accessToken) {
    return (
      <div className="cr-page">
        <style>{css}</style>
        <div className="cr-center">
          <div className="cr-login">
            <div className="cr-brand">
              <div className="cr-brand-mark">A</div>
              <div className="cr-brand-text">
                <strong>Approf</strong>
                <small>Revisão pedagógica</small>
              </div>
            </div>
            <h1>Acesso à revisão</h1>
            <p>
              Uma professora compartilhou os relatórios de desenvolvimento da turma com você para revisão pedagógica.
              Informe seu e-mail e a senha de acesso definida pela professora.
            </p>
            {inviteInfo && (
              <div className="cr-invite-info">
                <div className="cr-invite-row">
                  <span>Coordenadora</span>
                  <strong>{inviteInfo.coordinatorName || 'Coordenadora'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>E-mail da coordenadora</span>
                  <strong>{inviteInfo.coordinatorEmail || '-'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>Professora</span>
                  <strong>{inviteInfo.teacher?.name || 'Professora'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>E-mail</span>
                  <strong>{inviteInfo.teacher?.email || '-'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>Alunos</span>
                  <strong>{inviteInfo.studentCount}</strong>
                </div>
              </div>
            )}
            <input
              className="cr-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              type="email"
              autoComplete="email"
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
            <input
              className="cr-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha de acesso (6 caracteres)"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
            {error && <p className="cr-error">{error}</p>}
            <button className="cr-btn" onClick={verify} disabled={loading}>
              {loading ? 'Validando...' : 'Acessar relatórios'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !workspace) {
    return (
      <div className="cr-page">
        <style>{css}</style>
        <div className="cr-center">
          <p style={{ color: '#6E8C78', fontSize: 15 }}>Carregando turma...</p>
        </div>
      </div>
    )
  }

  if (isReviewFinalized) {
    return (
      <div className="cr-page">
        <style>{css}</style>
        <div className="cr-center">
          <div className="cr-finalized">
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2>Revisão finalizada!</h2>
            <p>
              A professora será notificada com o resultado da revisão.
              Ela poderá ver quais relatórios foram aprovados e quais precisam de correção.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cr-page">
      <style>{css}</style>
      <div className="cr-workspace">
        <header className="cr-topbar">
          <div className="cr-topbar-brand">
            <div className="cr-topbar-mark">A</div>
            <div className="cr-topbar-info">
              <strong>{className}</strong>
              <small>
                {coordinatorName ? `Revisão por ${coordinatorName}` : 'Revisão pedagógica'}
              </small>
            </div>
          </div>
          <div className="cr-progress">
            <strong>{reviewedCount}/{students.length}</strong>
            <span>alunos revisados</span>
          </div>
        </header>

        {error && (
          <div style={{ padding: '12px 28px 0' }}>
            <p className="cr-error" style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <div className="cr-body">
          <aside className="cr-sidebar">
            <h2>Alunos da turma</h2>
            {students.length === 0 && (
              <p style={{ fontSize: 13, color: '#6E8C78' }}>Nenhum aluno encontrado.</p>
            )}
            {students.map((student) => {
              const studentReports = reportsByStudent.get(student.id) ?? []
              const reviewStatus = getOverallStudentStatus(studentReports)
              const isActive = student.id === selectedStudent?.id
              return (
                <button
                  key={student.id}
                  className={`cr-student-btn${isActive ? ' active' : ''}`}
                  onClick={() => { setSelectedStudentId(student.id); setSelectedReportId('') }}
                >
                  <div>
                    <span className="cr-student-name">{student.full_name}</span>
                    <span className="cr-student-sub">
                      {studentReports.length === 0 ? 'Sem relatório' : `${studentReports.length} relatório(s)`}
                    </span>
                  </div>
                  <span className={`cr-badge ${reviewStatus}`}>{formatStudentStatus(reviewStatus)}</span>
                </button>
              )
            })}
          </aside>

          <main className="cr-main">
            {!selectedStudent ? (
              <div className="cr-empty">
                <strong>Selecione um aluno</strong>
                Escolha um aluno na lista para ver o relatório.
              </div>
            ) : selectedReports.length === 0 ? (
              <div className="cr-card">
                <p className="cr-eyebrow">Relatório de desenvolvimento</p>
                <h2>{selectedStudent.full_name}</h2>
                <div className="cr-empty" style={{ paddingTop: 24 }}>
                  <strong>Nenhum relatório gerado</strong>
                  Esta criança ainda não tem relatório de desenvolvimento.
                </div>
              </div>
            ) : (
              <div className="cr-card">
                <div className="cr-card-header">
                  <div>
                    <p className="cr-eyebrow">Relatório de desenvolvimento</p>
                    <h2>{selectedStudent.full_name}</h2>
                  </div>
                  {selectedReport && (
                    <span className={`cr-badge ${mapReportStatusToBadge(selectedReport.coordinator_review_status)}`} style={{ flexShrink: 0 }}>
                      {formatReportStatus(selectedReport.coordinator_review_status)}
                    </span>
                  )}
                </div>

                {selectedReports.length > 1 && (
                  <select
                    className="cr-select"
                    value={selectedReport?.id ?? ''}
                    onChange={(e) => setSelectedReportId(e.target.value)}
                  >
                    {selectedReports.map((report) => (
                      <option key={report.id} value={report.id}>
                        Relatório de {formatDate(report.created_at ?? report.updated_at)}
                      </option>
                    ))}
                  </select>
                )}

                {selectedReport && (
                  <>
                    <span className="cr-section-label">Conteúdo do relatório</span>
                    <div className="cr-editor-wrap">
                      <div className="cr-editor-toolbar" aria-label="Ferramentas de marcacao do relatorio">
                        <button type="button" className="cr-tool-btn" onMouseDown={(event) => { event.preventDefault(); applyReportCommand('bold') }}>B</button>
                        <button type="button" className="cr-tool-btn" onMouseDown={(event) => { event.preventDefault(); applyReportCommand('italic') }}>I</button>
                        <button type="button" className="cr-tool-btn" onMouseDown={(event) => { event.preventDefault(); applyReportCommand('underline') }}>U</button>
                        {[
                          ['#FFF2A8', 'Amarelo'],
                          ['#DDF7D8', 'Verde'],
                          ['#DDEBFF', 'Azul'],
                          ['#FFE0E6', 'Rosa'],
                        ].map(([color, label]) => (
                          <button
                            key={color}
                            type="button"
                            className="cr-color-btn"
                            style={{ background: color }}
                            title={`Marcar em ${label}`}
                            aria-label={`Marcar em ${label}`}
                            onMouseDown={(event) => { event.preventDefault(); applyReportHighlight(color) }}
                          />
                        ))}
                        <button type="button" className="cr-tool-btn" onMouseDown={(event) => { event.preventDefault(); applyReportCommand('removeFormat') }}>Limpar</button>
                      </div>
                      <div
                        key={selectedReport.id}
                        ref={reportEditorRef}
                        className="cr-document-editor"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) => setEditedBody(event.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(editedBody) }}
                      />
                    </div>
                    <p className="cr-editor-hint">Selecione um trecho do relatorio e use as cores para marcar pontos de correcao ou destaque.</p>

                    <span className="cr-section-label">Observação para a professora (opcional)</span>
                    <textarea
                      className="cr-notes-area"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Escreva aqui orientações, sugestões ou campos específicos para corrigir..."
                    />

                    {actionMessage && <p className="cr-success" style={{ marginTop: 12 }}>{actionMessage}</p>}

                    <div className="cr-actions">
                      <button
                        className="cr-action-btn comment"
                        onClick={() => submitReview('comment')}
                        disabled={submitting}
                      >
                        Salvar observação
                      </button>
                      <button
                        className="cr-action-btn request"
                        onClick={() => submitReview('request_changes')}
                        disabled={submitting}
                      >
                        Pedir correção
                      </button>
                      <button
                        className="cr-action-btn approve"
                        onClick={() => submitReview('approve')}
                        disabled={submitting}
                      >
                        {submitting ? 'Salvando...' : 'Aprovar relatório'}
                      </button>
                    </div>

                    {selectedEvents.length > 0 && (
                      <div className="cr-history">
                        <h3>Histórico de revisão</h3>
                        {selectedEvents.map((event) => (
                          <div key={event.id} className="cr-event">
                            <div className="cr-event-header">
                              <strong>{formatAction(event.action)}</strong>
                              <span>{formatDateTime(event.created_at)}</span>
                            </div>
                            {event.notes && <p>{event.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </main>
        </div>

        <div className="cr-finalize-bar">
          <div className="cr-finalize-info">
            <strong>Concluiu a revisão de todos os relatórios?</strong>
            {reviewedCount === 0
              ? 'Revise ao menos um relatório para finalizar.'
              : `${reviewedCount} de ${students.length} aluno(s) revisado(s).`}
          </div>
          <button
            className="cr-finalize-btn"
            onClick={finalize}
            disabled={!canFinalize || finalizing}
          >
            {finalizing ? 'Finalizando...' : 'Finalizar revisão'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getOverallStudentStatus(reports: Report[]): string {
  if (reports.length === 0) return 'no-report'
  const statuses = reports.map((r) => r.coordinator_review_status ?? 'pending')
  if (statuses.some((s) => s === 'changes_requested')) return 'changes'
  if (statuses.every((s) => s === 'approved')) return 'approved'
  if (statuses.some((s) => s === 'approved')) return 'approved'
  return 'pending'
}

function normalizeReportHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const decoded = decodeHtmlEntities(trimmed)
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(decoded)
  if (hasHtml) return sanitizeReportHtml(decoded)

  const paragraphs = decoded
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)

  return paragraphs.join('')
}

function sanitizeReportHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(href|src)="javascript:[^"]*"/gi, '')
    .replace(/\s(href|src)='javascript:[^']*'/gi, '')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatStudentStatus(status: string) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes') return 'Correção'
  if (status === 'no-report') return 'Sem relatório'
  return 'Pendente'
}

function mapReportStatusToBadge(status: string | null) {
  if (status === 'approved') return 'approved'
  if (status === 'changes_requested') return 'changes'
  return 'pending'
}

function formatReportStatus(status: string | null) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Correção solicitada'
  return 'Aguardando revisão'
}

function formatAction(action: string) {
  if (action === 'approve') return 'Relatório aprovado'
  if (action === 'request_changes') return 'Correção solicitada'
  if (action === 'comment') return 'Observação registrada'
  return action
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
