import { useMemo, useState } from 'react'
import { ChevronLeft, Search, ShieldCheck } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import type { ChildSearchPreview } from '@/types'

const EXTERNAL_PREVIEWS: ChildSearchPreview[] = [
  {
    id: 'external-1',
    childCode: 'CRI-MAN-8R4Q',
    name: 'Manuela Martins',
    birthDate: '2021-10-18',
    school: 'E.M. Joao XXIII',
    previousClass: 'Maternal II',
    lastTeacher: 'Prof. Camila',
    recordsCount: 12,
    timelineSummary: ['Adaptacao registrada', 'Avancos em autonomia', 'Participacao em musicalizacao'],
  },
]

export default function FindChildSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const [childCode, setChildCode] = useState('')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [requestedId, setRequestedId] = useState<string | null>(null)

  const localPreviews: ChildSearchPreview[] = useMemo(
    () =>
      classes.flatMap((cls) =>
        cls.students.map((student) => ({
          id: student.id,
          childCode: student.childCode ?? 'CRI-PENDENTE',
          name: student.name,
          birthDate: student.birthDate ?? '',
          school: cls.school,
          previousClass: cls.name,
          lastTeacher: 'Prof. Ana Lima',
          recordsCount: student.annotationCount,
          timelineSummary: (student.timeline ?? []).slice(0, 3).map((event) => event.title),
        })),
      ),
    [classes],
  )

  const results = [...localPreviews, ...EXTERNAL_PREVIEWS].filter((child) => {
    const byCode = childCode.trim() && child.childCode.toLowerCase().includes(childCode.trim().toLowerCase())
    const byIdentity =
      name.trim().length >= 2 &&
      child.name.toLowerCase().includes(name.trim().toLowerCase()) &&
      (!birthDate || child.birthDate === birthDate)

    return byCode || byIdentity
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">Buscar crianca existente</span>
          <span className="text-[11px] text-muted">Continuidade pedagogica com previa segura.</span>
        </div>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Codigo da crianca</label>
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
            placeholder="Ex: CRI-LUC-4F8K"
            value={childCode}
            onChange={(event) => setChildCode(event.target.value)}
          />
        </div>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-3">Sem codigo</p>
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mb-3 text-[14px] outline-none"
            placeholder="Nome da crianca"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 text-[14px] outline-none"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>

        <div className="rounded-app p-4 border border-gp mb-4" style={{ background: '#F0FAF4' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-gm mt-[2px] flex-shrink-0" />
            <p className="text-[12px] text-soft leading-[1.6]">
              A previa nao exibe fotos, documentos ou relatorios completos. Ela serve apenas para reconhecer se e a mesma crianca.
            </p>
          </div>
        </div>

        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
          Possiveis correspondencias
        </p>

        {results.length === 0 ? (
          <div className="bg-white rounded-app p-5 border border-border text-center">
            <Search size={22} className="text-muted mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">Nenhuma previa localizada</p>
            <p className="text-[12px] text-muted mt-1">Informe o codigo ou nome com data de nascimento.</p>
          </div>
        ) : (
          results.map((child) => (
            <article key={child.id} className="bg-white rounded-app p-4 border border-border shadow-card mb-3">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-ink">{child.name}</h3>
                  <p className="text-[11px] text-muted mt-1">{formatDate(child.birthDate)} - {child.previousClass}</p>
                </div>
                <span className="text-[10px] font-bold text-gm bg-gbg rounded-full px-2 py-1 h-fit">{child.childCode}</span>
              </div>
              <p className="text-[12px] text-soft mt-3">{child.school} - {child.recordsCount} registros pedagogicos</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {child.timelineSummary.map((item) => (
                  <span key={item} className="text-[10px] text-muted bg-cream rounded-full px-2 py-1 border border-border">{item}</span>
                ))}
              </div>
              <button
                onClick={() => setRequestedId(child.id)}
                className="w-full mt-3 py-[11px] rounded-app-sm bg-gm text-white text-sm font-bold"
              >
                {requestedId === child.id ? 'Solicitacao registrada' : 'Solicitar vinculo'}
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return 'Nascimento nao informado'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
