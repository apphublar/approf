'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, RefreshCcw, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { formatRelativeDate, teacherInitials } from '../lib/admin-utils'

type VerificationRequest = {
  id: string
  ownerId: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  createdAt: string
  teacher: {
    id: string
    full_name: string
    email: string
  } | null
  schools: Array<{ id: string; name: string }>
  documents: Array<{ fileName: string; signedUrl: string | null }>
}

export default function VerificationsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const pending = useMemo(() => requests.filter((item) => item.status === 'pending'), [requests])

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

  async function updateStatus(verificationId: string, status: 'approved' | 'rejected') {
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
      const teacher = requests.find((item) => item.id === verificationId)?.teacher?.full_name?.split(' ')[0] ?? 'professora'
      setToast(status === 'approved' ? `Verificação de ${teacher} aprovada` : `Verificação de ${teacher} rejeitada`)
      window.setTimeout(() => setToast(null), 2600)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Pessoas"
        title="Verificações"
        description="Fila de comprovantes de vínculo escolar. Aprovar libera o badge da escola no app."
        action={
          <button type="button" className="btn-ghost-v2" onClick={() => void loadRequests()}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />

      {error ? <p style={{ color: '#b4382f', marginBottom: 16 }}>{error}</p> : null}
      {loading ? <p style={{ color: '#8a948c' }}>Carregando verificações...</p> : null}

      {!loading && pending.length === 0 ? (
        <article className="empty-state-v2">
          <Check size={30} color="#1c6b46" />
          <h3>Tudo em dia</h3>
          <p>Nenhuma verificação pendente no momento.</p>
        </article>
      ) : null}

      {!loading
        ? pending.map((request) => {
            const name = request.teacher?.full_name || 'Professora'
            const doc = request.documents[0]
            const isUpdating = updatingId === request.id
            return (
              <article key={request.id} className="card-row-v2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span className="teacher-avatar">{teacherInitials(name)}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong style={{ fontSize: 15 }}>{name}</strong>
                    <div style={{ fontSize: 13, color: '#8a948c' }}>
                      {request.teacher?.email} · enviado {formatRelativeDate(request.createdAt)}
                    </div>
                    {request.schools[0]?.name ? (
                      <div style={{ fontSize: 12, color: '#5f6b63', marginTop: 4 }}>{request.schools[0].name}</div>
                    ) : null}
                  </div>
                  {doc?.signedUrl ? (
                    <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="btn-ghost-v2">
                      <ExternalLink size={15} /> Ver documento
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn-danger-v2 btn-sm-v2"
                    style={{ background: '#fff', border: '1px solid #f0c9c5' }}
                    disabled={isUpdating}
                    onClick={() => void updateStatus(request.id, 'rejected')}
                  >
                    <X size={14} /> Rejeitar
                  </button>
                  <button
                    type="button"
                    className="btn-primary-v2 btn-sm-v2"
                    disabled={isUpdating}
                    onClick={() => void updateStatus(request.id, 'approved')}
                  >
                    <Check size={14} /> Aprovar
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={notesById[request.id] ?? request.notes ?? ''}
                    onChange={(event) => setNotesById((current) => ({ ...current, [request.id]: event.target.value }))}
                    placeholder="Observação interna (em caso de rejeição)"
                    style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 9, border: '1px solid #e1e0d8', font: 'inherit' }}
                  />
                </div>
                {request.teacher?.id ? (
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/professoras/${request.teacher.id}?tab=verif`} style={{ fontSize: 12, color: '#1c6b46', fontWeight: 600 }}>
                      Abrir ficha completa →
                    </Link>
                  </div>
                ) : null}
              </article>
            )
          })
        : null}

      {toast ? (
        <div className="admin-toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
        </div>
      ) : null}
    </div>
  )
}
