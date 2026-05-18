import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

const CATEGORIES = [
  { label: 'Plano de Aula', emoji: 'ðŸ“‹', count: 6, bg: '#FFF3CD', isNew: true },
  { label: 'Lista de Chamada', emoji: 'ðŸ“‹', count: 4, bg: '#D0E8FF' },
  { label: 'Relatórios', emoji: 'ðŸ“„', count: 8, bg: '#D8F3DC', isNew: true },
  { label: 'Portfólio', emoji: '🗂️', count: 5, bg: '#FFE5D9' },
  { label: 'Atividades', emoji: 'âœï¸', count: 12, bg: '#E3D5F5' },
  { label: 'Avaliação', emoji: 'ðŸ“Š', count: 7, bg: '#F0E6FF' },
  { label: 'Comunicados', emoji: 'ðŸ“¢', count: 5, bg: '#FFE8CC' },
  { label: 'Aluno Atipico', emoji: 'ðŸ©º', count: 6, bg: '#FFD6D6', isNew: true },
  { label: 'Musicalizacao', emoji: 'ðŸŽµ', count: 8, bg: '#E0F2FE' },
  { label: 'Artes Visuais', emoji: 'ðŸŽ¨', count: 10, bg: '#FEF3C7' },
  { label: 'Reuniao de Pais', emoji: 'ðŸ¤', count: 3, bg: '#D8F3DC' },
  { label: 'Imagens e Recursos', emoji: 'ðŸ–¼ï¸', count: 7, bg: '#D0E8FF' },
]

export default function MaterialsScreen() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => CATEGORIES.filter((category) => category.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-[14px] border-b border-border flex-shrink-0">
        <span className="font-serif text-[22px] text-gd">Material de Apoio</span>
        <p className="text-xs text-muted mt-1">Arquivos publicados pelo Approf para baixar e usar</p>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="bg-white rounded-app p-3 border border-border shadow-card mt-[14px] mb-[12px]">
          <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
            <Search size={16} className="text-muted flex-shrink-0" />
            <input
              className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
              placeholder="Buscar material..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[11px]">
          {filtered.map((cat) => (
            <button
              key={cat.label}
              className="relative bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform"
            >
              {cat.isNew && (
                <span className="absolute top-3 right-9 text-[9px] font-bold px-2 py-[2px] rounded-full bg-gbg text-gm">
                  Novo
                </span>
              )}
              <div
                className="w-[48px] h-[48px] rounded-[13px] flex items-center justify-center text-[22px] flex-shrink-0"
                style={{ background: cat.bg }}
              >
                {cat.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-ink leading-tight">{cat.label}</p>
                <span className="text-[11px] text-muted">{cat.count} modelos</span>
              </div>
              <span className="text-muted text-[18px] flex-shrink-0">â€º</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-[13px] text-muted text-center py-10">Nenhum material encontrado.</p>
        )}
      </div>
    </div>
  )
}

