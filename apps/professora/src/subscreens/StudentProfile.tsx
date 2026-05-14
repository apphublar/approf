import { ChevronLeft, MoveRight, Pencil, Plus, Sparkles } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import type { TimelineEvent, TimelineEventType } from '@/types'
import { getAdjustedPhotoStyle } from '@/utils/photo'

const EVENT_STYLE: Record<TimelineEventType, { label: string; bg: string; fg: string }> = {
  evolucao: { label: 'Evolucao', bg: '#D8F3DC', fg: '#2D6A4F' },
  atividade: { label: 'Atividade', bg: '#FFF3CD', fg: '#856404' },
  foto: { label: 'Foto', bg: '#D0E8FF', fg: '#0A558C' },
  emocao: { label: 'Emocoes', bg: '#F0E6FF', fg: '#6B21A8' },
  alimentacao: { label: 'Alimentacao', bg: '#FFE8CC', fg: '#9C4E00' },
  socializacao: { label: 'Socializacao', bg: '#E3D5F5', fg: '#6930C3' },
  desenvolvimento: { label: 'Desenvolvimento', bg: '#D8F3DC', fg: '#2D6A4F' },
  marco: { label: 'Marco especial', bg: '#FFE5D9', fg: '#C1440E' },
}

export default function StudentProfileSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, activeStudentId, activeClassId, annotations } = useAppStore()

  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const student = cls?.students.find((item) => item.id === activeStudentId) ?? cls?.students[0]
  const studentAnns = annotations.filter(
    (annotation) =>
      annotation.studentId === student?.id ||
      annotation.studentName === `${student?.name.split(' ')[0]} ${student?.name.split(' ')[1]?.[0]}.`,
  )

  if (!student) return null

  const development = student.development ?? {
    linguagem: 45,
    socializacao: 45,
    coordenacao: 45,
    autonomia: 45,
  }
  const timeline: TimelineEvent[] = student.timeline ?? studentAnns.map((annotation) => ({
    id: annotation.id,
    type: 'evolucao' as const,
    title: annotation.label,
    text: annotation.text,
    date: annotation.date,
    tags: annotation.tags,
    attachmentName: annotation.attachmentName,
    attachmentUrl: null,
    attachmentKind: annotation.attachmentName ? 'file' : undefined,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">{student.name}</span>
          <span className="text-[11px] text-muted">{cls.name} - {student.age} anos{student.ageMonths ? ` e ${student.ageMonths} meses` : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openSubscreen('edit-student')}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-gm bg-white"
          >
            <Pencil size={15} />
          </button>
          <button onClick={() => openSubscreen('new-annotation')} className="text-[13px] font-bold text-gm">
            + Nota
          </button>
        </div>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="rounded-app p-5 mt-[14px] mb-[16px] text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-white/30 bg-white/15 flex-shrink-0 overflow-hidden">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={getAdjustedPhotoStyle(student.photoPosition)}
                />
              ) : (
                student.name.split(' ').slice(0, 2).map((name) => name[0]).join('')
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-serif text-[22px]">{student.name}</h2>
              <p className="text-[12px] opacity-75 mt-1">{cls.shift} - {cls.school}</p>
              {student.birthDate && <p className="text-[11px] opacity-65 mt-1">Nascimento: {formatBirthDate(student.birthDate)}</p>}
              <div className="flex gap-2 flex-wrap mt-3">
                {student.tag && <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{student.tag}</span>}
                <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{student.annotationCount} registros</span>
                <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{student.childCode ?? 'CRI-PENDENTE'}</span>
              </div>
            </div>
          </div>
        </div>

        {student.generalNotes && (
          <div className="bg-white rounded-app p-4 border border-border shadow-card mb-5">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Observacoes gerais</p>
            <p className="text-[13px] text-soft leading-[1.65]">{student.generalNotes}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-[10px] mb-5">
          {[
            { n: student.annotationCount, l: 'Registros' },
            { n: timeline.length, l: 'Marcos' },
            { n: student.age, l: 'Anos' },
          ].map((item) => (
            <div key={item.l} className="bg-white rounded-app p-3 text-center border border-border">
              <span className="block text-[20px] font-bold text-gd">{item.n}</span>
              <span className="block text-[10px] text-muted mt-[1px]">{item.l}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">Jornada individual</p>
        <div className="grid grid-cols-2 gap-[10px] mb-5">
          {[
            { label: 'Linguagem', value: development.linguagem },
            { label: 'Socializacao', value: development.socializacao },
            { label: 'Coord. Motora', value: development.coordenacao },
            { label: 'Autonomia', value: development.autonomia },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-app p-3 border border-border">
              <div className="text-[11px] font-bold text-ink mb-2">{item.label}</div>
              <div className="h-[6px] rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: 'linear-gradient(90deg,#4F8341,#83C451)' }} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => openSubscreen('report')}
          className="w-full py-[14px] rounded-app bg-gd text-white font-bold text-[14px] border-none flex items-center justify-center gap-2 mb-5 cursor-pointer"
        >
          <Sparkles size={16} strokeWidth={2} />
          Gerar relatorio com IA
        </button>

        <button
          onClick={() => openSubscreen('transfer-student')}
          className="w-full py-[13px] rounded-app-sm bg-white text-gm font-bold text-[14px] border border-gp flex items-center justify-center gap-2 mb-5 cursor-pointer"
        >
          <MoveRight size={16} strokeWidth={2} />
          Transferir ou mover crianca
        </button>

        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Timeline de evolucao</p>
          <button
            onClick={() => openSubscreen('new-timeline-event')}
            className="flex items-center gap-1 text-[12px] font-bold text-gm"
          >
            <Plus size={14} />
            Marco
          </button>
        </div>
        <div className="relative pl-7 pb-8">
          <div className="absolute left-[10px] top-0 bottom-0 w-[2px] bg-gp" />
          {timeline.map((event) => {
            const style = EVENT_STYLE[event.type]
            return (
              <article key={event.id} className="relative mb-[12px]">
                <span className="absolute left-[-22px] top-[16px] w-[10px] h-[10px] rounded-full border-2 border-white bg-gl" />
                <div className="bg-white rounded-app-sm p-4 border border-border shadow-card">
                  <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-full mb-2" style={{ background: style.bg, color: style.fg }}>
                    {style.label}
                  </span>
                  <h3 className="text-[13px] font-bold text-ink">{event.title}</h3>
                  <p className="text-[12px] text-soft leading-[1.6] mt-1">{event.text}</p>
                  {event.attachmentUrl && event.attachmentKind === 'image' && (
                    <img
                      src={event.attachmentUrl}
                      alt=""
                      className="mt-3 w-full max-h-56 object-cover rounded-app-sm border border-border"
                    />
                  )}
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {event.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-[2px] rounded-full bg-cream text-muted border border-border">{tag}</span>
                      ))}
                    </div>
                  )}
                  {event.attachmentName && !event.attachmentUrl && <p className="text-[10px] text-muted mt-2">Anexo: {event.attachmentName}</p>}
                  {event.attachmentName && event.attachmentKind === 'file' && <p className="text-[10px] text-muted mt-2">Anexo privado: {event.attachmentName}</p>}
                  <p className="text-[10px] text-muted mt-2">{event.date}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatBirthDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
