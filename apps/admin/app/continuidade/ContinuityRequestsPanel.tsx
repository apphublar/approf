'use client'

import { useState } from 'react'
import { CheckCircle2, Eye, X, XCircle } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'

interface SafeTimelineItem {
  date: string
  category: string
  summary: string
}

interface ChildLinkRequest {
  child: string
  childCode: string
  birthDate: string
  requester: string
  requesterCode: string
  previousTeacher: string
  school: string
  status: string
  reason: string
  preview: string[]
  safeTimelinePreview: SafeTimelineItem[]
}

interface DecisionState {
  type: 'approve' | 'deny'
  request: ChildLinkRequest
}

export function ContinuityRequestsPanel({ requests }: { requests: ChildLinkRequest[] }) {
  const [decision, setDecision] = useState<DecisionState | null>(null)
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'denied'>>({})

  function finishDecision(justification: string) {
    if (!decision || !justification.trim()) return

    setDecisions((current) => ({
      ...current,
      [decision.request.childCode]: decision.type === 'approve' ? 'approved' : 'denied',
    }))
    setDecision(null)
  }

  return (
    <>
      <article className="panel panel-wide">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Solicitacoes</p>
            <h2>Vinculo de crianca existente</h2>
          </div>
          <span className="status-pill">
            <Eye size={16} />
            Sem fotos na previa
          </span>
        </div>

        <div className="stack-list">
          {requests.map((request) => {
            const resolved = decisions[request.childCode]
            return (
              <div className="stack-item continuity-card" key={`${request.child}-${request.requester}`}>
                <div>
                  <strong>{request.child}</strong>
                  <small>{request.childCode} - nascimento {formatDate(request.birthDate)}</small>
                  <small>{request.school}</small>
                  <p>{request.reason}</p>
                  <div className="continuity-tags">
                    {request.preview.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <div className="continuity-actions">
                  {resolved ? <StatusBadge status={resolved === 'approved' ? 'active' : 'canceled'} /> : <StatusBadge status={request.status} />}
                  <small>Solicitante: {request.requester}</small>
                  <small>{request.requesterCode}</small>
                  <button
                    className="quiet-button"
                    disabled={Boolean(resolved)}
                    onClick={() => setDecision({ type: 'approve', request })}
                  >
                    <CheckCircle2 size={15} />
                    Aprovar
                  </button>
                  <button
                    className="quiet-button secondary-action"
                    disabled={Boolean(resolved)}
                    onClick={() => setDecision({ type: 'deny', request })}
                  >
                    <XCircle size={15} />
                    Negar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </article>

      {decision && (
        <DecisionModal
          decision={decision}
          onClose={() => setDecision(null)}
          onConfirm={finishDecision}
        />
      )}
    </>
  )
}

function DecisionModal({
  decision,
  onClose,
  onConfirm,
}: {
  decision: DecisionState
  onClose: () => void
  onConfirm: (justification: string) => void
}) {
  const [justification, setJustification] = useState('')
  const isApproval = decision.type === 'approve'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="decision-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{isApproval ? 'Aprovar vinculo' : 'Negar vinculo'}</p>
            <h2>{decision.request.child}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="decision-summary">
          <span>
            <strong>Codigo da crianca</strong>
            {decision.request.childCode}
          </span>
          <span>
            <strong>Solicitante</strong>
            {decision.request.requester} - {decision.request.requesterCode}
          </span>
          <span>
            <strong>Professora anterior</strong>
            {decision.request.previousTeacher}
          </span>
        </div>

        <section className="safe-preview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Previa segura da timeline</p>
              <h3>Marcos resumidos para conferencia</h3>
            </div>
            <span className="status-pill">Sem anexos</span>
          </div>
          <div className="safe-preview-list">
            {decision.request.safeTimelinePreview.map((item) => (
              <article key={`${item.date}-${item.category}`}>
                <span>{item.date}</span>
                <strong>{item.category}</strong>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <label className="decision-label">
          Justificativa para auditoria
          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder={isApproval ? 'Ex: dados conferidos com escola e previa bate com a crianca.' : 'Ex: dados insuficientes para confirmar identidade.'}
          />
        </label>

        <p className="modal-warning">
          Esta acao deve gerar log no Supabase com ator, data, decisao e justificativa. Fotos e relatorios completos seguem bloqueados ate o vinculo aprovado.
        </p>

        <div className="modal-actions">
          <button className="quiet-button secondary-action" onClick={onClose}>Cancelar</button>
          <button
            className="quiet-button"
            disabled={!justification.trim()}
            onClick={() => onConfirm(justification)}
          >
            {isApproval ? 'Confirmar aprovacao' : 'Confirmar negativa'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
