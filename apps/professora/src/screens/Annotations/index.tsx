import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import AnnotationCard from '@/components/ui/AnnotationCard'
import type { AnnotationCategory } from '@/types'

type AnnotationFilter = AnnotationCategory | 'todas' | 'pessoais'

const CHIPS: { id: AnnotationFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pessoais', label: 'Pessoais' },
  { id: 'evolucao', label: 'Evolucao' },
  { id: 'plano', label: 'Plano de aula' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'projeto', label: 'Projeto' },
  { id: 'formacao', label: 'Formacao' },
  { id: 'carta', label: 'Carta' },
  { id: 'atipico', label: 'Atipico' },
]

export default function AnnotationsScreen() {
  const { annotations, setActiveClass, setActiveStudent } = useAppStore()
  const { openSubscreen } = useNavStore()
  const [active, setActive] = useState<AnnotationFilter>('todas')

  const filtered = active === 'todas'
    ? annotations
    : active === 'pessoais'
      ? annotations.filter((annotation) => annotation.scope === 'personal')
      : annotations.filter((annotation) => annotation.category === active)

  function openAnnotation(annotation: (typeof annotations)[number]) {
    if (annotation.classId) setActiveClass(annotation.classId)
    if (annotation.studentId) {
      setActiveStudent(annotation.studentId)
      openSubscreen('student-profile')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-0 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="font-serif text-[22px] text-gd">Anotacoes</span>
          <button
            onClick={() => openSubscreen('new-annotation')}
            className="bg-gm text-white border-none rounded-full px-[14px] py-[7px] text-xs font-bold cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} strokeWidth={2.5} /> Nova
          </button>
        </div>

        <div className="flex gap-[7px] overflow-x-auto pb-[13px] scrollbar-none">
          {CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActive(chip.id)}
              className={`px-[13px] py-[6px] rounded-full text-xs font-semibold border-[1.5px] whitespace-nowrap flex-shrink-0 transition-colors ${
                active === chip.id
                  ? 'bg-gm border-gm text-white'
                  : 'bg-white border-border text-muted'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-area px-[18px] pt-[14px]">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <p className="text-[13px]">Nenhuma anotacao aqui ainda.</p>
          </div>
        ) : (
          filtered.map((annotation) => (
            <AnnotationCard
              key={annotation.id}
              annotation={annotation}
              onClick={() => openAnnotation(annotation)}
            />
          ))
        )}
      </div>

      <button
        onClick={() => openSubscreen('new-annotation')}
        className="absolute bottom-[76px] right-[18px] z-[99] w-[52px] h-[52px] rounded-full bg-gm text-white shadow-fab flex items-center justify-center"
      >
        <Plus size={24} strokeWidth={2} />
      </button>
    </div>
  )
}
