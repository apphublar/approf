'use client'

import { useEffect, useRef, useState } from 'react'
import { COORDINATOR_REVIEW_CSS } from '../../coordinator-review-styles'
import {
  formatDateTime,
  formatReportReviewStatus,
  formatReviewAction,
  mapReportStatusToBadge,
  normalizeReportHtml,
  sanitizeReportHtml,
} from '../../coordinator-report-content'

type ReviewEvent = {
  id: string
  report_id: string
  actor_name: string | null
  action: string
  notes: string | null
  created_at: string
}

type DocumentWorkspace = {
  share: { coordinator_name: string; coordinator_email: string }
  teacher: { full_name: string | null; email: string | null } | null
  report: {
    id: string
    report_type: string
    body: string | null
    coordinator_review_status: string | null
    coordinator_review_notes: string | null
    created_at: string
  }
  student: { full_name: string | null } | null
  classData: { name: string; shift: string | null; age_group: string | null } | null
  events: ReviewEvent[]
}

type InviteInfo = {
  coordinatorName: string
  coordinatorEmail: string
  accessStatus: string
  teacher: { name: string; email: string | null } | null
  reportType: string
}

type ReviewAction = 'comment' | 'request_changes' | 'approve'

export default function CoordinatorDocumentClient({ token }: { token: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [notes, setNotes] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const reportEditorRef = useRef<HTMLDivElement | null>(null)
  const storageKey = `approf:coordinator-doc:${token}`

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) setAccessToken(saved)
  }, [storageKey])

  useEffect(() => {
    void loadInviteInfo()
  }, [token])

  useEffect(() => {
    if (!accessToken) return
    void loadWorkspace(accessToken)
  }, [accessToken])

  useEffect(() => {
    if (!workspace?.report) return
    setEditedBody(normalizeReportHtml(workspace.report.body ?? ''))
    setNotes('')
    setActionMessage('')
    setError('')
  }, [workspace?.report?.id, workspace?.report?.body, workspace?.report?.coordinator_review_status])

  async function loadInviteInfo() {
    try {
      const response = await fetch(`/api/coordinator/public/document?token=${encodeURIComponent(token)}`)
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
      const response = await fetch('/api/coordinator/public/document', {
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
      const response = await fetch(`/api/coordinator/public/document?token=${encodeURIComponent(token)}`, {
        headers: { 'x-coordinator-access': nextAccessToken },
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Acesso não validado. Verifique a senha.')
        window.localStorage.removeItem(storageKey)
        setAccessToken('')
        return
      }
      setWorkspace(payload as DocumentWorkspace)
    } finally {
      setLoading(false)
    }
  }

  async function submitReview(action: ReviewAction) {
    if (!workspace?.report) return
    setError('')
    setActionMessage('')
    setSubmitting(true)
    try {
      const currentBody = reportEditorRef.current?.innerHTML ?? editedBody
      const response = await fetch(`/api/coordinator/public/reports/${workspace.report.id}`, {
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
        approve: 'Documento aprovado com sucesso.',
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

  if (!accessToken) {
    return (
      <div className="cr-page">
        <style>{COORDINATOR_REVIEW_CSS}</style>
        <div className="cr-center">
          <div className="cr-login">
            <div className="cr-brand">
              <div className="cr-brand-mark">A</div>
              <div className="cr-brand-text">
                <strong>Approf</strong>
                <small>Revisão pedagógica</small>
              </div>
            </div>
            <h1>Acesso ao documento</h1>
            <p>
              {inviteInfo?.teacher?.name
                ? `${inviteInfo.teacher.name} compartilhou ${formatReportType(inviteInfo.reportType)} com você para revisão pedagógica.`
                : 'Use o e-mail do convite e a senha definida pela professora para acessar o documento.'}
            </p>
            {inviteInfo && (
              <div className="cr-invite-info">
                <div className="cr-invite-row">
                  <span>Coordenadora</span>
                  <strong>{inviteInfo.coordinatorName || 'Coordenadora'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>E-mail</span>
                  <strong>{inviteInfo.coordinatorEmail || '-'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>Professora</span>
                  <strong>{inviteInfo.teacher?.name || 'Professora'}</strong>
                </div>
                <div className="cr-invite-row">
                  <span>Documento</span>
                  <strong>{formatReportType(inviteInfo.reportType)}</strong>
                </div>
              </div>
            )}
            <input
              className="cr-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Seu e-mail"
              type="email"
              autoComplete="email"
              onKeyDown={(event) => event.key === 'Enter' && void verify()}
            />
            <input
              className="cr-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha de acesso (6 caracteres)"
              maxLength={6}
              onKeyDown={(event) => event.key === 'Enter' && void verify()}
            />
            {error && <p className="cr-error">{error}</p>}
            <button className="cr-btn" type="button" onClick={() => void verify()} disabled={loading}>
              {loading ? 'Validando...' : 'Acessar documento'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !workspace) {
    return (
      <div className="cr-page">
        <style>{COORDINATOR_REVIEW_CSS}</style>
        <div className="cr-center">
          <p style={{ color: '#6E8C78', fontSize: 15 }}>Carregando documento...</p>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="cr-page">
        <style>{COORDINATOR_REVIEW_CSS}</style>
        <div className="cr-center">
          <div className="cr-login">
            <h1>Não foi possível abrir</h1>
            <p>{error || 'Tente validar o acesso novamente.'}</p>
            <button
              className="cr-btn"
              type="button"
              onClick={() => {
                window.localStorage.removeItem(storageKey)
                setAccessToken('')
                setWorkspace(null)
              }}
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    )
  }

  const report = workspace.report
  const events = workspace.events ?? []
  const metaParts = [
    workspace.teacher?.full_name ? `Professora: ${workspace.teacher.full_name}` : null,
    workspace.classData?.name ? `Turma: ${workspace.classData.name}` : null,
    workspace.student?.full_name ? `Criança: ${workspace.student.full_name}` : null,
  ].filter(Boolean)

  return (
    <div className="cr-page">
      <style>{COORDINATOR_REVIEW_CSS}</style>
      <div className="cr-workspace">
        <header className="cr-topbar">
          <div className="cr-topbar-brand">
            <div className="cr-topbar-mark">A</div>
            <div className="cr-topbar-info">
              <strong>{formatReportType(report.report_type)}</strong>
              <small>
                {workspace.share.coordinator_name
                  ? `Revisão por ${workspace.share.coordinator_name}`
                  : 'Revisão pedagógica'}
              </small>
            </div>
          </div>
          <span className={`cr-badge ${mapReportStatusToBadge(report.coordinator_review_status)}`}>
            {formatReportReviewStatus(report.coordinator_review_status)}
          </span>
        </header>

        {error && (
          <div style={{ padding: '12px 28px 0' }}>
            <p className="cr-error" style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <main className="cr-main">
          <div className="cr-card">
            <div className="cr-card-header">
              <div>
                <p className="cr-eyebrow">Documento compartilhado</p>
                <h2>{formatReportType(report.report_type)}</h2>
              </div>
              <span className={`cr-badge ${mapReportStatusToBadge(report.coordinator_review_status)}`}>
                {formatReportReviewStatus(report.coordinator_review_status)}
              </span>
            </div>

            {metaParts.length > 0 && <p className="cr-meta">{metaParts.join(' · ')}</p>}

            <span className="cr-section-label">Conteúdo do documento</span>
            <div className="cr-editor-wrap">
              <div className="cr-editor-toolbar" aria-label="Ferramentas de marcação do documento">
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
                key={report.id}
                ref={reportEditorRef}
                className="cr-document-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setEditedBody(event.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(editedBody) }}
              />
            </div>
            <p className="cr-editor-hint">Selecione um trecho do documento e use as cores para marcar pontos de correção ou destaque.</p>

            <span className="cr-section-label">Observação para a professora (opcional)</span>
            <textarea
              className="cr-notes-area"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Escreva aqui orientações, sugestões ou campos específicos para corrigir..."
            />

            {report.coordinator_review_notes && (
              <p className="cr-meta" style={{ marginTop: 12 }}>
                Última observação registrada: {report.coordinator_review_notes}
              </p>
            )}

            {actionMessage && <p className="cr-success" style={{ marginTop: 12 }}>{actionMessage}</p>}

            <div className="cr-actions">
              <button
                type="button"
                className="cr-action-btn comment"
                onClick={() => void submitReview('comment')}
                disabled={submitting}
              >
                Salvar observação
              </button>
              <button
                type="button"
                className="cr-action-btn request"
                onClick={() => void submitReview('request_changes')}
                disabled={submitting}
              >
                Pedir correção
              </button>
              <button
                type="button"
                className="cr-action-btn approve"
                onClick={() => void submitReview('approve')}
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Aprovar documento'}
              </button>
            </div>

            {events.length > 0 && (
              <div className="cr-history">
                <h3>Histórico de revisão</h3>
                {events.map((event) => (
                  <div key={event.id} className="cr-event">
                    <div className="cr-event-header">
                      <strong>{formatReviewAction(event.action)}</strong>
                      <span>{formatDateTime(event.created_at)}</span>
                    </div>
                    {event.notes && <p>{event.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function formatReportType(type: string) {
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
