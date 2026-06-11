import ApprofApple from './ApprofApple'

export default function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gp bg-gbg px-2.5 py-1 flex-shrink-0">
      <ApprofApple height={compact ? 14 : 16} className="text-[#282829]" />
      <span className={`font-bold text-gm ${compact ? 'text-[10px]' : 'text-[11px]'}`}>Verificado</span>
    </span>
  )
}
