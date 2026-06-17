'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import type { ContinuityRequestRow } from '../lib/continuity'

export function ContinuityRequestsPanel({ initialRequests }: { initialRequests: ContinuityRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [targetClassById, setTargetClassById] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

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
      if (!response.ok) throw new Error(payload?.error || 'Falha ao revisar solicitacao.')
      setRequests(payload?.requests ?? [])
      setToast(status === 'approved' ? 'Transferencia aprovada' : 'Transferencia recusada')
      window.setTimeout(() => setToast(null), 2600)
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Falha ao revisar solicitacao.')
    } finally {
      setUpdatingId(null)
    }
  }

  const pending = requests.filter((item) => item.status === 'pending')

  if (pending.length === 0) {
    return (
      <article className="empty-state-v2">
        <Check size={30} color="#1c6b46" />
        <h3>Nenhuma solicitacao pendente</h3>
        <p>Transferencias aprovadas aparecem no historico da auditoria.</p>
      </article>
    )
  }

  return (
    <>
      {error ? <p style={{ color: '#b4382f', marginBottom: 16 }}>{error}</p> : null}
      {pending.map((request) => (
        <article key={request.id} className="card-row-v2">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a948c', textTransform: 'uppercase' }}>Aluno</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{request.studentName ?? 'Crianca'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#5f6b63' }}>
              <span>{request.requesterName ?? 'Origem'}</span>
              <ArrowRight size={16} color="#1c6b46" />
              <span style={{ fontWeight: 600, color: '#16201b' }}>{request.targetTeacherCode ? `Codigo ${request.targetTeacherCode}` : 'Destino'}</span>
            </div>
          </div>
          {request.reason ? <p style={{ fontSize: 13, color: '#5f6b63', margin: '0 0 16px' }}>{request.reason}</p> : null}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', borderTop: '1px solid #f1f0ea', paddingTop: 16, flexWrap: 'wrap' }}>
            <div className="form-field-v2" style={{ flex: 1, maxWidth: 280 }}>
              <label htmlFor={`class-${request.id}`}>ID da turma de destino</label>
              <input
                id={`class-${request.id}`}
                value={targetClassById[request.id] ?? ''}
                onChange={(event) => setTargetClassById((current) => ({ ...current, [request.id]: event.target.value }))}
                placeholder="ex.: turma_2026_3a"
              />
            </div>
            <button
              type="button"
              className="btn-danger-v2"
              style={{ background: '#fff', border: '1px solid #f0c9c5' }}
              disabled={updatingId === request.id}
              onClick={() => void reviewRequest(request.id, 'rejected')}
            >
              Recusar
            </button>
            <button
              type="button"
              className="btn-primary-v2"
              disabled={updatingId === request.id}
              onClick={() => void reviewRequest(request.id, 'approved')}
            >
              Aprovar transferencia
            </button>
          </div>
        </article>
      ))}
      {toast ? (
        <div className="admin-toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
        </div>
      ) : null}
    </>
  )
}
