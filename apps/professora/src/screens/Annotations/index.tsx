import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import AnnotationCard from '@/components/ui/AnnotationCard'
import { getAppDataMode } from '@/services/app-data'
import { deleteSupabaseAnnotation, loadSupabaseAnnotations } from '@/services/supabase/annotations'

export default function AnnotationsScreen() {
  const { annotations, annotationsHasMore, removeAnnotation, setAnnotations, setAnnotationsHasMore, classes, userId } = useAppStore()
  const { openSubscreen } = useNavStore()
  const [query, setQuery] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    if (!normalizedQuery) return annotations
    return annotations.filter((annotation) =>
      normalizeText([
        annotation.label,
        formatCategory(annotation.category),
        annotation.text,
        annotation.studentName ?? '',
        annotation.date,
        ...(annotation.tags ?? []),
      ].join(' ')).includes(normalizedQuery),
    )
  }, [annotations, query])

  function openAnnotation(annotation: (typeof annotations)[number]) {
    openSubscreen('new-annotation', { annotationId: annotation.id })
  }

  async function loadAllAnnotations() {
    if (loadingMore || getAppDataMode() !== 'supabase') return
    setLoadingMore(true)
    try {
      const { annotations: all, hasMore } = await loadSupabaseAnnotations(userId, classes, { limitDays: null })
      setAnnotations(all)
      setAnnotationsHasMore(hasMore)
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDeleteAnnotation(annotationId: string) {
    const confirmed = window.confirm('Deseja excluir esta anotação? Esta ação não pode ser desfeita.')
    if (!confirmed) return

    try {
      if (getAppDataMode() === 'supabase') {
        await deleteSupabaseAnnotation(annotationId)
      }
      removeAnnotation(annotationId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a anotação.'
      window.alert(message)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="font-serif text-[22px] text-gd">Anotações</span>
          <button
            onClick={() => openSubscreen('new-annotation')}
            className="bg-gm text-white border-none rounded-full px-[14px] py-[7px] text-xs font-bold cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} strokeWidth={2.5} /> Nova
          </button>
        </div>

        <div className="bg-cream rounded-app-sm border border-border px-3 py-2 flex items-center gap-2">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por tipo, texto, criança ou data..."
            className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
          />
        </div>
      </div>

      <div className="scroll-area px-[18px] pt-[14px]">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <p className="text-[13px]">Nenhuma anotação por aqui ainda.</p>
          </div>
        ) : (
          filtered.map((annotation) => (
            <AnnotationCard
              key={annotation.id}
              annotation={annotation}
              onClick={() => openAnnotation(annotation)}
              onDelete={() => handleDeleteAnnotation(annotation.id)}
            />
          ))
        )}
        {annotationsHasMore && !query && (
          <button
            onClick={() => void loadAllAnnotations()}
            disabled={loadingMore}
            className="w-full mt-3 mb-6 py-3 rounded-app border border-border bg-white text-[12px] font-bold text-muted disabled:opacity-50"
          >
            {loadingMore ? 'Carregando...' : 'Carregar anotações mais antigas'}
          </button>
        )}
      </div>

    </div>
  )
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatCategory(category: string) {
  const labels: Record<string, string> = {
    evolucao: 'Evolução',
    plano: 'Planejamento',
    portfolio: 'Portfólio',
    projeto: 'Projeto',
    formacao: 'Formação',
    carta: 'Carta',
    atipico: 'Atípico',
  }
  return labels[category] ?? 'Anotação'
}

