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
}: {
  annotation: Annotation
  onClick?: () => void
}) {
  const badgeStyle = BADGE_STYLES[annotation.category] ?? BADGE_STYLES['evolucao']
  const scopeLabel = annotation.scope === 'personal' ? 'Pessoal' : null
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-app px-[15px] py-[13px] mb-[9px] border border-border shadow-card cursor-pointer active:scale-[.98] transition-transform"
    >
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
      <p className="text-[11px] text-muted mt-[5px]">{annotation.date}</p>
    </div>
  )
}
