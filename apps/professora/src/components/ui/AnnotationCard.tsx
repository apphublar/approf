import { ImageIcon, Paperclip, Pencil, Trash2 } from 'lucide-react'
import type { Annotation } from '@/types'

const BADGE_STYLES: Record<string, string> = {
  evolucao: 'bg-[#D8F3DC] text-[#4F8341]',
  plano:    'bg-[#FFF3CD] text-[#856404]',
  portfolio:'bg-[#E3D5F5] text-[#6930C3]',
  projeto:  'bg-[#FFE5D9] text-[#C1440E]',
  formacao: 'bg-[#D0E8FF] text-[#0A558C]',
  carta:    'bg-[#F0E6FF] text-[#6B21A8]',
  atipico:  'bg-[#D8F3DC] text-[#4F8341]',
}

export default function AnnotationCard({
  annotation,
  onClick,
  onDelete,
}: {
  annotation: Annotation
  onClick?: () => void
  onDelete?: () => void
}) {
  const badgeStyle = BADGE_STYLES[annotation.category] ?? BADGE_STYLES['evolucao']
  const scopeLabel = annotation.scope === 'personal' ? 'Pessoal' : null
  const transcribed = annotation.tags?.includes('Transcrição de áudio')
  const hasActions = Boolean(onClick || onDelete)

  return (
    <div className="bg-white rounded-app px-[15px] py-[13px] mb-[9px] border border-border shadow-card">
      <div className="flex items-center gap-[7px] mb-[5px]">
        <span className={`text-[10px] font-bold px-2 py-[3px] rounded-full ${badgeStyle}`}>
          {annotation.label}
        </span>
        {annotation.studentName && (
          <span className="text-[11px] text-muted ml-auto">{annotation.studentName}</span>
        )}
        {scopeLabel && !annotation.studentName && (
          <span className="text-[11px] text-muted ml-auto">{scopeLabel}</span>
        )}
      </div>
      <p className="text-[13px] text-soft leading-[1.5]">{annotation.text}</p>
      {transcribed && (
        <span className="inline-block text-[10px] font-bold px-2 py-[3px] rounded-full bg-gbg text-gm mt-2">
          Transcrição de áudio
        </span>
      )}
      {annotation.attachmentUrl && annotation.attachmentKind === 'image' && (
        <a href={annotation.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-3">
          <img
            src={annotation.attachmentUrl}
            alt={annotation.attachmentName ?? 'Anexo privado'}
            className="w-full max-h-48 object-cover rounded-app-sm border border-border"
          />
        </a>
      )}
      {annotation.attachmentUrl && annotation.attachmentKind === 'file' && (
        <a
          href={annotation.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-2 rounded-app-sm border border-border bg-cream px-3 py-2 text-[12px] font-bold text-gm"
        >
          <Paperclip size={14} />
          <span className="flex-1 truncate">{annotation.attachmentName ?? 'Anexo privado'}</span>
        </a>
      )}
      {annotation.attachmentName && !annotation.attachmentUrl && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <ImageIcon size={13} />
          Anexo privado: {annotation.attachmentName}
        </p>
      )}
      <p className="text-[11px] text-muted mt-[5px]">{annotation.date}</p>
      {hasActions && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
          {onClick && (
            <button
              type="button"
              onClick={onClick}
              className="flex items-center gap-1.5 text-[12px] font-bold text-gm"
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-[12px] font-bold text-[#C1440E] ml-auto"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
