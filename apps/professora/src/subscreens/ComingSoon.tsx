import { ChevronLeft } from 'lucide-react'
import { useNavStore } from '@/store'

const SCREEN_CONFIG: Record<string, { title: string; emoji: string; desc: string; badge: string }> = {
  calendar: {
    title: 'Calendário',
    emoji: '📅',
    desc: 'Visualize eventos, feriados e tarefas pedagógicas do ano letivo. Organize sua rotina de forma visual.',
    badge: 'Calendário pedagógico completo em breve',
  },
  community: {
    title: 'Comunidade',
    emoji: '🌱',
    desc: 'Troque experiências, ideias e materiais com outras professoras de Educação Infantil de todo o Brasil.',
    badge: 'Feed da comunidade em breve',
  },
  documents: {
    title: 'Documentos',
    emoji: '📁',
    desc: 'Seus documentos pessoais armazenados com segurança — atestados, formações, certificados e mais.',
    badge: 'Armazenamento de documentos em breve',
  },
}

export default function ComingSoonSubscreen({ screen }: { screen: string }) {
  const { closeSubscreen } = useNavStore()
  const cfg = SCREEN_CONFIG[screen] ?? {
    title: 'Em breve',
    emoji: '✨',
    desc: 'Esta funcionalidade está sendo preparada.',
    badge: 'Em breve no Approf',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      {/* Top bar */}
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button
          onClick={closeSubscreen}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white flex-shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd">{cfg.title}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 pb-20">
        <div
          className="w-24 h-24 rounded-[28px] flex items-center justify-center text-5xl"
          style={{ background: '#D8F3DC' }}
        >
          {cfg.emoji}
        </div>
        <div className="text-center">
          <h2 className="font-serif text-[22px] text-gd mb-2">{cfg.title}</h2>
          <p className="text-[14px] text-muted leading-[1.7] max-w-[280px]">{cfg.desc}</p>
        </div>
        <div
          className="px-5 py-3 rounded-app border border-gp text-center"
          style={{ background: '#F0FAF4' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: '#4F8341' }}>
            ✦ {cfg.badge}
          </p>
        </div>
      </div>
    </div>
  )
}
