'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCcw, XCircle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'

type VerificationRequest = {
  id: string
  ownerId: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  createdAt: string
  updatedAt: string
  teacher: {
    id: string
    full_name: string
    email: string
    phone: string | null
  } | null
  schools: Array<{
    id: string
    name: string
    city: string | null
    state: string | null
  }>
  documents: Array<{
    path: string
    fileName: string
    mimeType: string
    size: number
    signedUrl: string | null
  }>
}

export default function VerificationsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === 'pending').length,
    [requests],
  )

  useEffect(() => {
    void loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/account/verification/admin')
      const payload = await response.json().catch(() => null) as { error?: string; requests?: VerificationRequest[] } | null
      if (!response.ok) throw new Error(payload?.error || 'Falha ao carregar verificações.')
      setRequests(payload?.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar verificações.')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(verificationId: string, status: 'pending' | 'approved' | 'rejected') {
    setUpdatingId(verificationId)
    setError('')
    try {
      const response = await fetch('/api/account/verification/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          status,
          reviewNotes: notesById[verificationId] ?? '',
        }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; requests?: VerificationRequest[] } | null
      if (!response.ok) throw new Error(payload?.error || 'Falha ao atualizar status.')
      setRequests(payload?.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Conformidade da conta"
        title="Verificações de perfil"
        description="Revise documentos enviados pelas professoras e aprove ou rejeite o vínculo escolar."
        action={
          <button className="quiet-button secondary-action" onClick={() => void loadRequests()}>
            <RefreshCcw size={15} />
            Atualizar
          </button>
        }
      />

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Fila atual</p>
            <h2>{pendingCount} solicitação(ões) pendente(s)</h2>
          </div>
        </div>

        {error && <p className="topbar-description" style={{ color: 'var(--red-700)', marginTop: 0 }}>{error}</p>}

        {loading ? (
          <p className="topbar-description" style={{ marginTop: 0 }}>Carregando verificações...</p>
        ) : requests.length === 0 ? (
          <p className="topbar-description" style={{ marginTop: 0 }}>Sem solicitações no momento.</p>
        ) : (
          <div className="table">
            <div className="table-row table-head verifications-grid">
              <span>Professora</span>
              <span>Status</span>
              <span>Escolas</span>
              <span>Documentos</span>
              <span>Ações</span>
            </div>

            {requests.map((request) => {
              const isUpdating = updatingId === request.id
              return (
                <div key={request.id} className="table-row verifications-grid">
                  <span>
                    <strong>{request.teacher?.full_name || 'Professora não identificada'}</strong>
                    <small>{request.teacher?.email || request.ownerId}</small>
                    <small>Enviado em {formatDate(request.createdAt)}</small>
                  </span>

                  <StatusBadge status={request.status} />

                  <span>
                    {request.schools.length === 0 ? (
                      <small>Sem escola informada</small>
                    ) : (
                      request.schools.map((school) => (
                        <small key={school.id}>{school.name}</small>
                      ))
                    )}
                  </span>

                  <span>
                    {request.documents.length === 0 ? (
                      <small>Sem documentos</small>
                    ) : (
                      request.documents.map((document, index) => (
                        document.signedUrl ? (
                          <a
                            key={`${document.path}-${index}`}
                            href={document.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="verification-doc-link"
                          >
                            {document.fileName}
                          </a>
                        ) : (
                          <small key={`${document.path}-${index}`}>{document.fileName}</small>
                        )
                      ))
                    )}
                  </span>

                  <div>
                    <textarea
                      value={notesById[request.id] ?? request.notes ?? ''}
                      onChange={(event) =>
                        setNotesById((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      className="verification-notes"
                      placeholder="Observação para auditoria interna."
                    />
                    <div className="action-row">
                      <button
                        className="quiet-button"
                        disabled={isUpdating}
                        onClick={() => void updateStatus(request.id, 'approved')}
                      >
                        <CheckCircle2 size={14} />
                        Aprovar
                      </button>
                      <button
                        className="quiet-button secondary-action"
                        disabled={isUpdating}
                        onClick={() => void updateStatus(request.id, 'rejected')}
                      >
                        <XCircle size={14} />
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </article>
    </>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
