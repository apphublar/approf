'use client'

import { useState } from 'react'
import type { ContinuityRequestRow } from '../lib/continuity'

export function ContinuityRequestsPanel({ initialRequests }: { initialRequests: ContinuityRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [targetClassById, setTargetClassById] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function reviewRequest(requestId: string, status: 'approved' | 'rejected') {
    setUpdatingId(requestId)
    setError('')
    try {
      const response = await fetch('/api/continuity/requests/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status,
          targetClassId: targetClassById[requestId] || null,
        }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; requests?: ContinuityRequestRow[] } | null
      if (!response.ok) throw new Error(payload?.error || 'Falha ao revisar solicitação.')
      setRequests(payload?.requests ?? [])
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Falha ao revisar solicitação.')
    } finally {
      setUpdatingId(null)
    }
  }

  const pending = requests.filter((item) => item.status === 'pending')

  return (
    <article className="panel panel-wide spaced-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Solicitações</p>
          <h2>Vínculos e transferências</h2>
        </div>
        <span className="status-pill">{pending.length} pendentes</span>
      </div>

      {error && <p className="text-muted-panel" style={{ color: '#a33a20' }}>{error}</p>}

      {requests.length === 0 ? (
        <p className="text-muted-panel">Nenhuma solicitação registrada ainda.</p>
      ) : (
        <div className="table-list">
          {requests.map((request) => (
            <div className="table-row" key={request.id}>
              <div>
                <strong>{request.studentName ?? 'Criança'}</strong>
                <p className="text-muted-panel">
                  {labelRequestType(request.requestType)} · {request.requesterName ?? 'Professora solicitante'} · {formatDate(request.createdAt)}
                </p>
                {request.reason && <p className="text-muted-panel">{request.reason}</p>}
                {request.targetTeacherCode && <p className="text-muted-panel">Código destino: {request.targetTeacherCode}</p>}
              </div>
              <div className="continuity-actions">
                <span className={`status-pill status-${request.status}`}>{labelStatus(request.status)}</span>
                {request.status === 'pending' && (
                  <>
                    <input
                      className="input-compact"
                      placeholder="ID da turma destino (aprovação)"
                      value={targetClassById[request.id] ?? ''}
                      onChange={(event) =>
                        setTargetClassById((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="button-primary"
                      disabled={updatingId === request.id}
                      onClick={() => void reviewRequest(request.id, 'approved')}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={updatingId === request.id}
                      onClick={() => void reviewRequest(request.id, 'rejected')}
                    >
                      Rejeitar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function labelRequestType(value: ContinuityRequestRow['requestType']) {
  switch (value) {
    case 'link':
      return 'Vínculo'
    case 'transfer_teacher':
      return 'Transferência entre professoras'
    case 'transfer_class':
      return 'Mudança de turma'
    default:
      return value
  }
}

function labelStatus(value: ContinuityRequestRow['status']) {
  switch (value) {
    case 'pending':
      return 'Pendente'
    case 'approved':
      return 'Aprovada'
    case 'rejected':
      return 'Rejeitada'
    case 'canceled':
      return 'Cancelada'
    default:
      return value
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}
