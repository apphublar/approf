import { useMemo, useState } from 'react'

const CATEGORIES = [
  { label: 'Plano de Aula', emoji: '📋', count: 6, bg: '#FFF3CD', isNew: true },
  { label: 'Lista de Chamada', emoji: '📋', count: 4, bg: '#D0E8FF' },
  { label: 'Relatorios', emoji: '📄', count: 8, bg: '#D8F3DC', isNew: true },
  { label: 'Portfolio', emoji: '🗂️', count: 5, bg: '#FFE5D9' },
  { label: 'Atividades', emoji: '✏️', count: 12, bg: '#E3D5F5' },
  { label: 'Avaliacao', emoji: '📊', count: 7, bg: '#F0E6FF' },
  { label: 'Comunicados', emoji: '📢', count: 5, bg: '#FFE8CC' },
  { label: 'Aluno Atipico', emoji: '🩺', count: 6, bg: '#FFD6D6', isNew: true },
  { label: 'Musicalizacao', emoji: '🎵', count: 8, bg: '#E0F2FE' },
  { label: 'Artes Visuais', emoji: '🎨', count: 10, bg: '#FEF3C7' },
  { label: 'Reuniao de Pais', emoji: '🤝', count: 3, bg: '#D8F3DC' },
  { label: 'Imagens e Recursos', emoji: '🖼️', count: 7, bg: '#D0E8FF' },
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
        <div className="bg-white rounded-app-sm border border-border px-3 py-2 mt-[14px] mb-[12px]">
          <input
            className="w-full bg-transparent outline-none text-[13px] text-ink"
            placeholder="Buscar material..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
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
              <span className="text-muted text-[18px] flex-shrink-0">›</span>
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
