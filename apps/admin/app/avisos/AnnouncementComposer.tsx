'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Info, Megaphone, PartyPopper, Send } from 'lucide-react'
import {
  ANNOUNCEMENT_TYPES,
  AUDIENCE_LABELS,
  type AnnouncementAudience,
  type AnnouncementType,
} from '../lib/announcement-types'
import { sendAnnouncementAction } from './actions'

const TYPE_ICONS: Record<AnnouncementType, typeof PartyPopper> = {
  novidade: PartyPopper,
  info: Info,
  alerta: AlertTriangle,
  manutencao: Megaphone,
}

export function AnnouncementComposer({
  audienceCounts,
}: {
  audienceCounts: Record<AnnouncementAudience, number>
}) {
  const [type, setType] = useState<AnnouncementType>('novidade')
  const [audience, setAudience] = useState<AnnouncementAudience>('todas')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [pinned, setPinned] = useState(false)

  const typeMeta = ANNOUNCEMENT_TYPES[type]
  const reach = audienceCounts[audience] ?? 0

  const previewTitle = title.trim() || 'Titulo do aviso'
  const previewBody = body.trim() || 'A mensagem que voce escrever aparece aqui, exatamente como a professora vera no app.'

  return (
    <div className="announcement-layout-v2">
      <form action={sendAnnouncementAction} className="panel-v2 panel-v2-padded">
        <p className="page-eyebrow" style={{ marginBottom: 18 }}>Novo aviso</p>

        <label className="form-field-v2" style={{ width: '100%', marginBottom: 18 }}>
          <span>Tipo</span>
          <div className="announcement-type-grid">
            {(Object.keys(ANNOUNCEMENT_TYPES) as AnnouncementType[]).map((key) => {
              const Icon = TYPE_ICONS[key]
              const meta = ANNOUNCEMENT_TYPES[key]
              const active = type === key
              return (
                <button
                  key={key}
                  type="button"
                  className={`announcement-type-btn${active ? ' is-active' : ''}`}
                  style={active ? { background: meta.accent, borderColor: meta.accent } : undefined}
                  onClick={() => setType(key)}
                >
                  <Icon size={15} /> {meta.label}
                </button>
              )
            })}
          </div>
        </label>
        <input type="hidden" name="type" value={type} />

        <label className="form-field-v2" style={{ width: '100%' }}>
          <span>Titulo</span>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Manutencao programada neste sabado" required />
        </label>

        <label className="form-field-v2" style={{ width: '100%', marginTop: 16 }}>
          <span>Mensagem</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 240))}
            rows={5}
            placeholder="Escreva o aviso que a professora vera no app…"
            required
          />
        </label>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#a7ada3', marginBottom: 16 }}>{body.length}/240</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <label className="form-field-v2">
            <span>Publico</span>
            <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}>
              {(Object.keys(AUDIENCE_LABELS) as AnnouncementAudience[]).map((key) => (
                <option key={key} value={key}>{AUDIENCE_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <label className="form-field-v2">
            <span>Botao de acao (opcional)</span>
            <input name="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="ex.: Ver detalhes" />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8f8f4', border: '1px solid #eef0ec', borderRadius: 10, padding: '12px 14px', marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" name="pinned" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <span>
            <strong style={{ display: 'block', fontSize: 14 }}>Fixar no topo do app</strong>
            <small style={{ color: '#8a948c' }}>Mantem o aviso visivel ate a professora dispensar.</small>
          </span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f1f0ea', paddingTop: 18 }}>
          <button type="submit" className="btn-primary-v2"><Send size={16} /> Enviar para o app</button>
          <span style={{ fontSize: 13, color: '#5f6b63' }}>Chega a <strong>{reach}</strong> professora(s).</span>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="preview-phone-v2">
          <p className="page-eyebrow" style={{ color: '#8fae9d', marginBottom: 14 }}>Pre-visualizacao no app</p>
          <div className="preview-phone-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span className="teacher-avatar" style={{ width: 26, height: 26, borderRadius: 7, background: '#0c2a1e', color: '#fff' }}>A</span>
              <strong style={{ fontSize: 13 }}>Approf</strong>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a7ada3' }}>agora</span>
            </div>
            <div className="preview-card-v2" style={{ borderLeftColor: typeMeta.accent }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, color: typeMeta.accent, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {typeMeta.label}
              </div>
              <strong style={{ display: 'block', marginBottom: 5 }}>{previewTitle}</strong>
              <p style={{ margin: 0, fontSize: 13, color: '#5f6b63', lineHeight: 1.5 }}>{previewBody}</p>
              {ctaLabel.trim() ? (
                <button type="button" className="btn-primary-v2 btn-sm-v2" style={{ marginTop: 12, background: typeMeta.accent }}>
                  {ctaLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AnnouncementHistory({
  items,
}: {
  items: Array<{
    id: string
    type: AnnouncementType
    title: string
    audience: AnnouncementAudience
    recipientCount: number
    created_at: string
  }>
}) {
  const rows = useMemo(() => items, [items])

  return (
    <article className="panel-v2" style={{ marginTop: 20 }}>
      <div className="panel-v2-header"><h2>Avisos enviados</h2></div>
      {rows.length === 0 ? (
        <div className="empty-state-v2" style={{ padding: 28 }}><p>Nenhum aviso enviado ainda.</p></div>
      ) : (
        rows.map((item) => {
          const meta = ANNOUNCEMENT_TYPES[item.type]
          const Icon = TYPE_ICONS[item.type]
          return (
            <div key={item.id} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f4f3ee' }}>
              <span className="teacher-avatar" style={{ background: `${meta.accent}20`, color: meta.accent }}>
                <Icon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 14 }}>{item.title}</strong>
                <small style={{ display: 'block', color: '#8a948c', fontSize: 12 }}>
                  {AUDIENCE_LABELS[item.audience]} · {item.recipientCount} profs · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.created_at))}
                </small>
              </div>
            </div>
          )
        })
      )}
    </article>
  )
}
