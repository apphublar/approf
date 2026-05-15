import { ChevronLeft, FileQuestion, NotebookPen, Sparkles } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'

export default function PendingSubscreen() {
  const { closeSubscreen, openSubscreen, setTab } = useNavStore()
  const { annotations, classes } = useAppStore()
  const undirectedNotes = annotations.filter((annotation) =>
    !annotation.studentId && !annotation.classId && !annotation.studentName && annotation.scope !== 'personal'
  )
  const studentsWithoutRecentNote = getStudentsWithoutRecentNote(annotations, classes)

  const hasPending = undirectedNotes.length > 0 || studentsWithoutRecentNote.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Pendencias</span>
      </div>

      <div className="scroll-area px-[18px] py-5">
        <div className="bg-gbg border border-gp rounded-app p-4 mb-4">
          <p className="text-[13px] font-bold text-gd mb-2">Sugestoes para revisar</p>
          <p className="text-[12px] text-muted leading-[1.6]">
            Aqui ficam pontos que merecem um olhar rapido antes de gerar relatorios, planejamentos ou portfolios.
          </p>
        </div>

        {!hasPending && (
          <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
            <Sparkles size={25} className="text-gm mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">Tudo em dia</p>
            <p className="text-[12px] text-muted mt-1 leading-[1.5]">
              Nao encontramos anotacoes sem destino nem criancas sem registro recente.
            </p>
          </div>
        )}

        {undirectedNotes.length > 0 && (
          <section className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
              Anotacoes sem destino
            </p>
            <button
              onClick={() => setTab('annotations')}
              className="w-full bg-white rounded-app p-4 border border-border shadow-card flex items-start gap-3 text-left active:scale-[.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: '#FFF3CD', color: '#856404' }}>
                <NotebookPen size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-ink">{undirectedNotes.length} para classificar</p>
                <p className="text-[12px] text-muted leading-[1.5]">
                  Revise anotacoes livres para vincular a uma crianca, turma ou uso pedagogico.
                </p>
              </div>
            </button>
          </section>
        )}

        {studentsWithoutRecentNote.length > 0 && (
          <section className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
              Sem registro recente
            </p>
            <div className="flex flex-col gap-[9px]">
              {studentsWithoutRecentNote.slice(0, 6).map((item) => (
                <button
                  key={`${item.classId}-${item.studentId}`}
                  onClick={() => {
                    useAppStore.getState().setActiveClass(item.classId)
                    useAppStore.getState().setActiveStudent(item.studentId)
                    openSubscreen('new-annotation')
                  }}
                  className="w-full bg-white rounded-app p-4 border border-border shadow-card flex items-start gap-3 text-left active:scale-[.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: '#E3D5F5', color: '#6930C3' }}>
                    <FileQuestion size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-ink">{item.studentName}</p>
                    <p className="text-[12px] text-muted leading-[1.5]">
                      {item.lastLabel}. Toque para registrar uma observacao.
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function getStudentsWithoutRecentNote(
  annotations: ReturnType<typeof useAppStore.getState>['annotations'],
  classes: ReturnType<typeof useAppStore.getState>['classes'],
) {
  const now = Date.now()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  return classes.flatMap((classData) =>
    classData.students.map((student) => {
      const last = annotations
        .filter((annotation) => annotation.studentId === student.id || annotation.studentName === student.name)
        .map((annotation) => new Date(annotation.date).getTime())
        .filter((time) => Number.isFinite(time))
        .sort((a, b) => b - a)[0]

      const days = last ? Math.floor((now - last) / (24 * 60 * 60 * 1000)) : null
      return {
        classId: classData.id,
        studentId: student.id,
        studentName: student.name,
        last,
        lastLabel: days === null ? 'Sem anotacoes ainda' : `${days} dias sem nova anotacao`,
      }
    }),
  ).filter((item) => !item.last || now - item.last > sevenDaysMs)
}
