'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function CoordinatorReviewClient({ token }: { token: string }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [events, setEvents] = useState<ReviewEvent[]>([])
  const [className, setClassName] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedReportId, setSelectedReportId] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const storageKey = `approf:coordinator:${token}`

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) setAccessToken(saved)
  }, [storageKey])

  useEffect(() => {
    if (!accessToken) return
    loadWorkspace(accessToken)
  }, [accessToken])

  const reportsByStudent = useMemo(() => {
    const map = new Map<string, Report[]>()
    reports.forEach((report) => {
      if (!report.student_id) return
      map.set(report.student_id, [...(map.get(report.student_id) ?? []), report])
    })
    return map
  }, [reports])

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0]
  const selectedReports = selectedStudent ? reportsByStudent.get(selectedStudent.id) ?? [] : []
  const selectedReport = selectedReports.find((report) => report.id === selectedReportId) ?? selectedReports[0]
  const selectedEvents = selectedReport ? events.filter((event) => event.report_id === selectedReport.id) : []

  useEffect(() => {
    if (!selectedStudent && students[0]) setSelectedStudentId(students[0].id)
  }, [selectedStudent, students])

  useEffect(() => {
    if (!selectedReport && selectedReports[0]) setSelectedReportId(selectedReports[0].id)
  }, [selectedReport, selectedReports])

  useEffect(() => {
    setEditedBody(selectedReport?.body ?? '')
    setNotes('')
  }, [selectedReport?.id])

  async function verify() {
    setError('')
    setMessage('')
    const response = await fetch('/api/coordinator/public/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, code }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Não foi possível validar o acesso.')
      return
    }
    window.localStorage.setItem(storageKey, payload.accessToken)
    setAccessToken(payload.accessToken)
  }

  async function loadWorkspace(nextAccessToken = accessToken) {
    setError('')
    const response = await fetch(`/api/coordinator/public/workspace?token=${encodeURIComponent(token)}`, {
      headers: { 'x-coordinator-access': nextAccessToken },
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Acesso não validado.')
      window.localStorage.removeItem(storageKey)
      setAccessToken('')
      return
    }
    setClassName(payload.classData?.name ?? 'Turma compartilhada')
    setStudents(payload.students ?? [])
    setReports(payload.reports ?? [])
    setEvents(payload.events ?? [])
  }

  async function updateReport(action: 'comment' | 'request_changes' | 'approve') {
    if (!selectedReport) return
    setError('')
    setMessage('')
    const response = await fetch(`/api/coordinator/public/reports/${selectedReport.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-coordinator-access': accessToken },
      body: JSON.stringify({ token, action, notes, body: editedBody }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Não foi possível salvar a revisão.')
      return
    }
    setMessage(action === 'approve' ? 'Relatório aprovado.' : action === 'request_changes' ? 'Correção solicitada.' : 'Observação registrada.')
    await loadWorkspace()
  }

  if (!accessToken) {
    return (
      <main className="coordinator-page">
        <section className="coordinator-card">
          <p className="eyebrow">Approf</p>
          <h1>Validação da coordenadora</h1>
          <p>Informe seu e-mail e o código recebido para acessar os relatórios da turma.</p>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail da coordenadora" />
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código de acesso" />
          {error && <small className="error">{error}</small>}
          <button onClick={verify}>Validar acesso</button>
        </section>
      </main>
    )
  }

  return (
    <main className="coordinator-page coordinator-page--wide">
      <header className="coordinator-header">
        <div>
          <p className="eyebrow">Revisão pedagógica</p>
          <h1>{className}</h1>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="coordinator-layout">
        <aside className="coordinator-list">
          {students.map((student) => {
            const studentReports = reportsByStudent.get(student.id) ?? []
            return (
              <button key={student.id} onClick={() => setSelectedStudentId(student.id)} className={student.id === selectedStudent?.id ? 'active' : ''}>
                <strong>{student.full_name}</strong>
                <span>{studentReports.length} relatório(s)</span>
              </button>
            )
          })}
        </aside>
        <section className="coordinator-card coordinator-review">
          <div className="review-title">
            <div>
              <p className="eyebrow">{selectedStudent?.full_name ?? 'Criança'}</p>
              <h2>Relatório de desenvolvimento</h2>
            </div>
            {selectedReport && <span className={`review-status ${selectedReport.coordinator_review_status ?? 'pending'}`}>{formatStatus(selectedReport.coordinator_review_status)}</span>}
          </div>
          {selectedReports.length > 1 && (
            <select value={selectedReport?.id ?? ''} onChange={(event) => setSelectedReportId(event.target.value)}>
              {selectedReports.map((report) => (
                <option key={report.id} value={report.id}>Relatório de {new Date(report.created_at ?? report.updated_at).toLocaleDateString('pt-BR')}</option>
              ))}
            </select>
          )}
          {!selectedReport ? (
            <p>Esta criança ainda não tem relatório de desenvolvimento gerado.</p>
          ) : (
            <>
              <textarea className="report-body" value={editedBody} onChange={(event) => setEditedBody(event.target.value)} />
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação para a professora" />
              <div className="review-actions">
                <button onClick={() => updateReport('comment')}>Salvar observação</button>
                <button onClick={() => updateReport('request_changes')}>Pedir correção</button>
                <button onClick={() => updateReport('approve')}>Aprovar relatório</button>
              </div>
              <div className="review-events">
                <h3>Histórico</h3>
                {selectedEvents.length === 0 ? <p>Sem ações registradas ainda.</p> : selectedEvents.map((event) => (
                  <article key={event.id}>
                    <strong>{formatAction(event.action)}</strong>
                    <span>{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                    {event.notes && <p>{event.notes}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function formatStatus(status?: string | null) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Correção solicitada'
  return 'Aguardando aprovação'
}

function formatAction(action: string) {
  if (action === 'approve') return 'Relatório aprovado'
  if (action === 'request_changes') return 'Correção solicitada'
  if (action === 'comment') return 'Observação registrada'
  return action
}
