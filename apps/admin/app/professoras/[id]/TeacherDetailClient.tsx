'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react'
import { GiztokensAdjustForm } from '../../components/GiztokensAdjustForm'
import {
  accessStatusFromSubscription,
  formatCurrencyFromCents,
  formatNumberPt,
  formatPlanLabel,
  teacherInitials,
  verificationStatusLabel,
} from '../../lib/admin-utils'
import { adjustTeacherGiztokensAction } from '../actions'
import {
  blockTeacherAccess,
  liberarAcessoGratuito,
  sendPaymentOverdueNotice,
  updateTeacherSubscription,
} from '../../assinaturas/actions'
import { approveTeacherVerificationAction, rejectTeacherVerificationAction } from './actions'

type TabKey = 'visao' | 'assinatura' | 'ia' | 'verif' | 'hist'

type TeacherDetailClientProps = {
  teacher: {
    id: string
    name: string
    email: string
    phone: string | null
    schoolLabel: string
    subscription: {
      id: string
      status: string
      plan: string
      external_reference: string | null
      current_period_end: string | null
      notes: string | null
    } | null
    verificationStatus: string
  }
  stats: {
    classes: number
    students: number
    generations30d: number
    aiCostCents: number
    gizRemaining: number
    gizIncluded: number
  }
  verification: {
    id: string
    documents: Array<{ fileName: string; signedUrl: string | null }>
  } | null
  activity: Array<{ id: string; action: string; detail: string; when: string; actor: string }>
  teacherOptions: Array<{ id: string; name: string; email: string }>
  monthStart: string
}

const planOptions = [
  { value: 'free', label: 'Gratis' },
  { value: 'trial_7_days', label: 'Trial 7 dias' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
]

const statusOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Ativo' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'canceled', label: 'Cancelada' },
]

export function TeacherDetailClient(props: TeacherDetailClientProps) {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabKey) || 'visao'
  const tab = ['visao', 'assinatura', 'ia', 'verif', 'hist'].includes(initialTab) ? initialTab : 'visao'
  const returnTo = `/professoras/${props.teacher.id}`
  const status = accessStatusFromSubscription(props.teacher.subscription)
  const gizPct = props.stats.gizIncluded > 0
    ? Math.min(100, Math.round((props.stats.gizRemaining / props.stats.gizIncluded) * 100))
    : 0
  const doc = props.verification?.documents[0]

  return (
    <div className="admin-page-wrap" style={{ maxWidth: 1080 }}>
      <Link href="/professoras" className="btn-ghost-v2" style={{ background: 'none', padding: 0, marginBottom: 18, color: '#5f6b63' }}>
        <ArrowLeft size={17} /> Voltar para Professoras
      </Link>

      <article className="detail-header-v2">
        <div className="detail-header-inner">
          <span className="teacher-avatar teacher-avatar-lg">{teacherInitials(props.teacher.name)}</span>
          <div className="detail-header-copy">
            <h1>{props.teacher.name}</h1>
            <p>{props.teacher.email} · {props.teacher.schoolLabel}</p>
            <div className="detail-badges">
              <span className={`status-chip status-chip-${status}`}>
                {status === 'active' ? 'Pagando' : status === 'free' ? 'Gratis' : status === 'overdue' ? 'Em atraso' : status === 'blocked' ? 'Bloqueada' : 'Trial'}
              </span>
              <span className="status-chip status-chip-free">{formatPlanLabel(props.teacher.subscription?.plan)}</span>
              <span className={`status-chip status-chip-${props.teacher.verificationStatus === 'approved' ? 'approved' : props.teacher.verificationStatus === 'rejected' ? 'rejected' : 'pending'}`}>
                Verificacao: {verificationStatusLabel(props.teacher.verificationStatus)}
              </span>
            </div>
          </div>
          <div className="detail-actions">
            <form action={liberarAcessoGratuito}>
              <input type="hidden" name="teacherId" value={props.teacher.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="btn-secondary-v2">Liberar gratis</button>
            </form>
            <form action={sendPaymentOverdueNotice}>
              <input type="hidden" name="teacherId" value={props.teacher.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="btn-warn-v2">Avisar atraso</button>
            </form>
            <form action={blockTeacherAccess}>
              <input type="hidden" name="teacherId" value={props.teacher.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" className="btn-danger-v2">Bloquear</button>
            </form>
          </div>
        </div>
      </article>

      <div className="tab-bar-v2">
        {([
          ['visao', 'Visao geral'],
          ['assinatura', 'Assinatura'],
          ['ia', 'IA & GizTokens'],
          ['verif', 'Verificacao'],
          ['hist', 'Historico'],
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <Link
            key={key}
            href={`${returnTo}?tab=${key}`}
            className={tab === key ? 'is-active' : ''}
            style={{
              background: 'none',
              border: 'none',
              padding: '11px 16px',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              color: tab === key ? '#16201b' : '#8a948c',
              borderBottom: tab === key ? '2px solid #1c6b46' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === 'visao' && (
        <>
          <section className="stat-grid-v2">
            <article className="stat-card-v2"><p>Turmas</p><strong>{props.stats.classes}</strong></article>
            <article className="stat-card-v2"><p>Alunos</p><strong>{props.stats.students}</strong></article>
            <article className="stat-card-v2"><p>Geracoes (30d)</p><strong>{props.stats.generations30d}</strong></article>
            <article className="stat-card-v2"><p>Custo IA</p><strong>{formatCurrencyFromCents(props.stats.aiCostCents)}</strong></article>
          </section>
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <article className="panel-v2 panel-v2-padded">
              <p className="page-eyebrow" style={{ marginBottom: 14 }}>Saldo GizTokens — mes atual</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <strong style={{ fontSize: 32 }}>{formatNumberPt(props.stats.gizRemaining)}</strong>
                <span style={{ color: '#8a948c' }}>/ {formatNumberPt(props.stats.gizIncluded)} do plano</span>
              </div>
              <div className="giz-progress-bar giz-progress-bar-lg">
                <span style={{ width: `${gizPct}%`, display: 'block', height: '100%', background: '#1c6b46', borderRadius: 6 }} />
              </div>
              <p className="form-help-v2">Ajuste o saldo na aba “IA & GizTokens”.</p>
            </article>
            <article className="panel-v2 panel-v2-padded">
              <p className="page-eyebrow" style={{ marginBottom: 14 }}>Atividade recente</p>
              {props.activity.length === 0 ? (
                <p style={{ color: '#8a948c', fontSize: 13 }}>Nenhuma acao registrada ainda.</p>
              ) : (
                props.activity.slice(0, 3).map((item) => (
                  <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f4f3ee' }}>
                    <strong style={{ fontSize: 13 }}>{item.action}</strong>
                    <small style={{ display: 'block', color: '#8a948c', fontSize: 12 }}>{item.detail} · {formatWhen(item.when)}</small>
                  </div>
                ))
              )}
            </article>
          </section>
        </>
      )}

      {tab === 'assinatura' && (
        <article className="panel-v2 panel-v2-padded" style={{ maxWidth: 640 }}>
          <p className="page-eyebrow" style={{ marginBottom: 16 }}>Editar assinatura</p>
          <form action={updateTeacherSubscription} className="subs-edit-form">
            <input type="hidden" name="teacherId" value={props.teacher.id} />
            <input type="hidden" name="returnTo" value={`${returnTo}?tab=assinatura`} />
            <div className="subs-row-2">
              <select name="plan" defaultValue={props.teacher.subscription?.plan ?? 'free'}>
                {planOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select name="status" defaultValue={props.teacher.subscription?.status ?? 'active'}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <input
              name="paymentLink"
              defaultValue={props.teacher.subscription?.external_reference ?? ''}
              placeholder="Link de pagamento Stripe"
            />
            <input
              name="currentPeriodEnd"
              type="date"
              defaultValue={toDateInput(props.teacher.subscription?.current_period_end)}
            />
            <textarea name="notes" rows={2} defaultValue={props.teacher.subscription?.notes ?? ''} placeholder="Observacoes internas" />
            <button type="submit" className="btn-primary-v2">Salvar alteracoes</button>
            <p className="form-help-v2">A cobranca real vem do checkout Stripe no app.</p>
          </form>
        </article>
      )}

      {tab === 'ia' && (
        <>
          <section className="stat-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <article className="stat-card-v2"><p>Geracoes (30d)</p><strong>{props.stats.generations30d}</strong></article>
            <article className="stat-card-v2"><p>Custo estimado</p><strong>{formatCurrencyFromCents(props.stats.aiCostCents)}</strong></article>
          </section>
          <GiztokensAdjustForm
            teachers={props.teacherOptions}
            defaultTeacherId={props.teacher.id}
            action={adjustTeacherGiztokensAction}
            monthLabel={props.monthStart}
            returnTo={`${returnTo}?tab=ia`}
          />
        </>
      )}

      {tab === 'verif' && (
        <article className="panel-v2 panel-v2-padded" style={{ maxWidth: 640 }}>
          {props.verification && doc ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid #e8e7e1', borderRadius: 11, marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <strong>{doc.fileName}</strong>
                  <small style={{ display: 'block', color: '#8a948c' }}>Enviado pela professora · {props.teacher.schoolLabel}</small>
                </div>
                {doc.signedUrl ? (
                  <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="btn-ghost-v2">
                    <ExternalLink size={15} /> Abrir
                  </a>
                ) : null}
              </div>
              <form action={rejectTeacherVerificationAction} style={{ marginBottom: 14 }}>
                <input type="hidden" name="verificationId" value={props.verification.id} />
                <input type="hidden" name="teacherId" value={props.teacher.id} />
                <input type="hidden" name="returnTo" value={`${returnTo}?tab=verif`} />
                <label className="form-field-v2" style={{ width: '100%' }}>
                  <span>Observacao interna (em caso de rejeicao)</span>
                  <textarea name="notes" rows={3} placeholder="opcional…" />
                </label>
              </form>
              <div style={{ display: 'flex', gap: 10 }}>
                <form action={approveTeacherVerificationAction}>
                  <input type="hidden" name="verificationId" value={props.verification.id} />
                  <input type="hidden" name="teacherId" value={props.teacher.id} />
                  <input type="hidden" name="returnTo" value={`${returnTo}?tab=verif`} />
                  <button type="submit" className="btn-primary-v2"><Check size={16} /> Aprovar verificacao</button>
                </form>
                <form action={rejectTeacherVerificationAction}>
                  <input type="hidden" name="verificationId" value={props.verification.id} />
                  <input type="hidden" name="teacherId" value={props.teacher.id} />
                  <input type="hidden" name="returnTo" value={`${returnTo}?tab=verif`} />
                  <button type="submit" className="btn-danger-v2" style={{ background: '#fff', border: '1px solid #f0c9c5' }}>
                    <X size={16} /> Rejeitar
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p style={{ color: '#8a948c' }}>Nenhum comprovante pendente para esta professora.</p>
          )}
          <p className="form-help-v2">Aprovar libera o badge da escola nos documentos do app.</p>
        </article>
      )}

      {tab === 'hist' && (
        <article className="history-list-v2" style={{ maxWidth: 760 }}>
          {props.activity.length === 0 ? (
            <div className="empty-state-v2"><p>Nenhuma acao registrada para esta professora.</p></div>
          ) : (
            props.activity.map((item) => (
              <div key={item.id} className="history-item-v2">
                <Check size={16} color="#1c6b46" />
                <div style={{ flex: 1 }}>
                  <strong>{item.action}</strong>
                  <small>{item.detail} · por {item.actor}</small>
                </div>
                <time>{formatWhen(item.when)}</time>
              </div>
            ))
          )}
        </article>
      )}
    </div>
  )
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
