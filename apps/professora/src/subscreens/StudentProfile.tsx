import { useEffect, useState } from 'react'
import { ChevronLeft, ExternalLink, FileText, MoveRight, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import type { TimelineEvent, TimelineEventType } from '@/types'
import { getAppDataMode } from '@/services/app-data'
import { deleteSupabaseAnnotation } from '@/services/supabase/annotations'
import { deleteSupabaseTimelineEvent } from '@/services/supabase/timeline'
import { listReports } from '@/services/reports'
import { listReportReviewEvents, type ReportReviewEvent } from '@/services/coordinator-review'
import { getAdjustedPhotoStyle } from '@/utils/photo'
import { getStudentAttendanceSummary } from '@/utils/attendance'
import AnnotationCard from '@/components/ui/AnnotationCard'
import type { GeneratedDocument } from '@/types'

const EVENT_STYLE: Record<TimelineEventType, { label: string; bg: string; fg: string }> = {
  evolucao: { label: 'Evolução', bg: '#D8F3DC', fg: '#2D6A4F' },
  atividade: { label: 'Atividade', bg: '#FFF3CD', fg: '#856404' },
  foto: { label: 'Foto', bg: '#D0E8FF', fg: '#0A558C' },
  emocao: { label: 'Emoções', bg: '#F0E6FF', fg: '#6B21A8' },
  alimentacao: { label: 'Alimentação', bg: '#FFE8CC', fg: '#9C4E00' },
  socializacao: { label: 'Socialização', bg: '#E3D5F5', fg: '#6930C3' },
  desenvolvimento: { label: 'Desenvolvimento', bg: '#D8F3DC', fg: '#2D6A4F' },
  marco: { label: 'Marco especial', bg: '#FFE5D9', fg: '#C1440E' },
}

const ANNOTATION_PREVIEW_COUNT = 3

export default function StudentProfileSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, activeStudentId, activeClassId, annotations, attendanceRecords, removeAnnotation, removeTimelineEvent } = useAppStore()
  const [showAllAnnotations, setShowAllAnnotations] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [developmentReports, setDevelopmentReports] = useState<GeneratedDocument[]>([])
  const [reviewEvents, setReviewEvents] = useState<ReportReviewEvent[]>([])

  useEffect(() => {
    setShowAllAnnotations(false)
  }, [activeStudentId])

  const activeClass = classes.find((item) => item.id === activeClassId)
  const classWithActiveStudent = classes.find((item) => item.students.some((student) => student.id === activeStudentId))
  const cls = activeClass?.students.some((student) => student.id === activeStudentId)
    ? activeClass
    : classWithActiveStudent ?? activeClass ?? classes[0]
  const student = cls?.students.find((item) => item.id === activeStudentId) ?? cls?.students[0]
  if (!student || !cls) return null

  const studentNameNormalized = normalizeText(student.name)
  const studentAnns = annotations.filter(
    (annotation) =>
      annotation.studentId === student?.id ||
      normalizeText(annotation.studentName ?? '') === studentNameNormalized ||
      annotation.studentName === `${student?.name.split(' ')[0]} ${student?.name.split(' ')[1]?.[0]}.`,
  )

  const timeline: TimelineEvent[] = student.timeline ?? []
  const totalNotes = studentAnns.length
  const totalMilestones = timeline.length
  const totalRecords = totalNotes + totalMilestones + generatedCount
  const attendanceSummary = getStudentAttendanceSummary(
    student,
    attendanceRecords.filter((record) => record.classId === cls.id),
  )
  const totalAttendanceCalls = attendanceSummary.totalCalls
  const totalAbsences = attendanceSummary.absenceCount
  const totalPresences = attendanceSummary.presences
  const attendanceRate = attendanceSummary.rate
  const visibleAnnotations = showAllAnnotations
    ? studentAnns
    : studentAnns.slice(0, ANNOTATION_PREVIEW_COUNT)
  const hasMoreAnnotations = studentAnns.length > ANNOTATION_PREVIEW_COUNT

  useEffect(() => {
    let active = true
    listReports({ studentId: student.id, limit: 200, compact: true })
      .then((reports) => {
        if (!active) return
        setGeneratedCount(reports.length)
        setDevelopmentReports(reports.filter((report) => report.report_type === 'development_report'))
      })
      .catch(() => {
        if (!active) return
        setGeneratedCount(0)
        setDevelopmentReports([])
      })
    return () => {
      active = false
    }
  }, [student.id])

  useEffect(() => {
    let active = true
    listReportReviewEvents({ studentId: student.id })
      .then((events) => {
        if (active) setReviewEvents(events)
      })
      .catch(() => {
        if (active) setReviewEvents([])
      })
    return () => {
      active = false
    }
  }, [student.id])

  async function handleDeleteTimelineEvent(eventId: string) {
    const confirmed = window.confirm('Deseja excluir este marco? Esta ação não pode ser desfeita.')
    if (!confirmed) return

    try {
      if (getAppDataMode() === 'supabase') {
        await deleteSupabaseTimelineEvent(eventId)
      }
      removeTimelineEvent(cls.id, student.id, eventId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o marco.'
      window.alert(message)
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
      if (showAllAnnotations && studentAnns.length <= ANNOTATION_PREVIEW_COUNT + 1) {
        setShowAllAnnotations(false)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a anotação.'
      window.alert(message)
    }
  }

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
          <button onClick={() => openSubscreen('new-annotation', {
            prefill: {
              classId: cls.id,
              studentId: student.id,
              directStudentNote: true,
            },
          })} className="subtle-attention text-[13px] font-bold text-gm">
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
              <p className="text-[11px] opacity-65 mt-1">
                {student.birthDate ? `Nascimento: ${formatBirthDate(student.birthDate)} · ${formatStudentAge(student.age, student.ageMonths)}` : formatStudentAge(student.age, student.ageMonths)}
              </p>
              <div className="flex gap-2 flex-wrap mt-3">
                {student.tag && <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{student.tag}</span>}
                <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{totalRecords} registros</span>
                <span className="bg-white/18 text-white text-[10px] font-bold px-3 py-1 rounded-full">{student.childCode ?? 'CRI-PENDENTE'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-app p-3 border border-border shadow-card mb-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-ink">Presenças</p>
              <p className="text-[11px] text-muted">{totalPresences} presenças · {totalAbsences} faltas</p>
            </div>
            <div className="text-right">
              <span className="text-[15px] font-bold text-gm">{attendanceRate}%</span>
              <span className="text-[10px] block text-muted">presença</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-cream overflow-hidden mt-3">
            <div className="h-full rounded-full bg-gm transition-all" style={{ width: `${attendanceRate}%` }} />
          </div>
          <p className="text-[12px] text-muted mt-3">
            {totalAttendanceCalls > 0 ? 'A frequência é atualizada conforme as chamadas realizadas.' : 'Ainda não há chamadas registradas para esta turma.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-[10px] mb-5">
          {[
            { n: totalNotes, l: 'Notas' },
            { n: totalMilestones, l: 'Marcos' },
          ].map((item) => (
            <div key={item.l} className="bg-white rounded-app p-3 text-center border border-border">
              <span className="block text-[20px] font-bold text-gd">{item.n}</span>
              <span className="block text-[10px] text-muted mt-[1px]">{item.l}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => openSubscreen('new-annotation', {
            prefill: {
              classId: cls.id,
              studentId: student.id,
              directStudentNote: true,
            },
          })}
          className="w-full py-[14px] rounded-app bg-white text-gd font-bold text-[14px] border border-gp mb-3 cursor-pointer"
        >
          Fazer anotação direta do aluno
        </button>

        <button
          onClick={() => openSubscreen('report', {
            reportKind: 'Relatório de desenvolvimento',
            classId: cls.id,
            studentId: student.id,
          })}
          className="w-full py-[14px] rounded-app bg-gd text-white font-bold text-[14px] border-none flex items-center justify-center gap-2 mb-5 cursor-pointer"
        >
          <Sparkles size={16} strokeWidth={2} />
          Gerar relatório de desenvolvimento
        </button>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Aprovação da coordenadora</p>
            <span className="text-[11px] text-muted">{developmentReports.length} relatório(s)</span>
          </div>
          {developmentReports.length === 0 ? (
            <p className="text-[12px] text-muted leading-[1.6]">
              Nenhum relatório de desenvolvimento foi gerado para esta criança.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {developmentReports.slice(0, 5).map((report) => (
                <button
                  key={report.id}
                  onClick={() => openSubscreen('document-detail', { reportId: report.id })}
                  className="w-full rounded-app-sm border border-border bg-cream px-3 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-ink">Relatório de {formatShortDate(report.created_at)}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getReviewStatusClass(report.coordinator_review_status)}`}>
                      {formatReviewStatus(report.coordinator_review_status)}
                    </span>
                  </div>
                  {report.coordinator_review_notes && (
                    <p className="text-[11px] text-muted mt-2 leading-[1.4]">{report.coordinator_review_notes}</p>
                  )}
                </button>
              ))}
            </div>
          )}
          {reviewEvents.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-bold text-muted mb-2">Histórico da coordenadora</p>
              {reviewEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="mb-3">
                  <p className="text-[12px] font-bold text-ink">{formatReviewAction(event.action)}</p>
                  <p className="text-[11px] text-muted">{event.actor_name || 'Coordenadora'} · {formatShortDate(event.created_at)}</p>
                  {event.notes && <p className="text-[11px] text-muted mt-1 leading-[1.4]">{event.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Histórico de anotações</p>
            <span className="text-[11px] text-muted">{studentAnns.length} registro(s)</span>
          </div>
          {studentAnns.length === 0 ? (
            <p className="text-[12px] text-muted leading-[1.6]">
              Ainda não há anotações dessa criança. Use o botão de nota para começar.
            </p>
          ) : (
            <>
              {visibleAnnotations.map((annotation) => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  onClick={() => openSubscreen('new-annotation', { annotationId: annotation.id })}
                  onDelete={() => handleDeleteAnnotation(annotation.id)}
                />
              ))}
              {hasMoreAnnotations && (
                <button
                  type="button"
                  onClick={() => setShowAllAnnotations((current) => !current)}
                  className="w-full mt-1 py-2 text-[12px] font-bold text-gm"
                >
                  {showAllAnnotations ? 'Ver menos' : `Ver todas (${studentAnns.length})`}
                </button>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-5">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Gerados da criança</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => openSubscreen('generated-documents', { studentId: student.id, kind: 'all' })}
              className="rounded-app-sm border border-gp bg-gbg px-3 py-3 text-left text-gd"
            >
              <span className="block text-[13px] font-bold">Tudo</span>
              <span className="block text-[11px] mt-1">Histórico geral</span>
            </button>
            <button
              onClick={() => openSubscreen('generated-documents', { studentId: student.id, kind: 'documents' })}
              className="rounded-app-sm border border-border bg-cream px-3 py-3 text-left text-muted"
            >
              <span className="block text-[13px] font-bold">Docs</span>
              <span className="block text-[11px] mt-1">Relatórios e textos</span>
            </button>
            <button
              onClick={() => openSubscreen('generated-documents', { studentId: student.id, kind: 'images' })}
              className="rounded-app-sm border border-border bg-cream px-3 py-3 text-left text-muted"
            >
              <span className="block text-[13px] font-bold">Imagens</span>
              <span className="block text-[11px] mt-1">Portfólios visuais</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => openSubscreen('transfer-student')}
          className="w-full py-[13px] rounded-app-sm bg-white text-gm font-bold text-[14px] border border-gp flex items-center justify-center gap-2 mb-5 cursor-pointer"
        >
          <MoveRight size={16} strokeWidth={2} />
          Transferir ou mover criança
        </button>

        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Timeline de evolução</p>
          <button
            onClick={() =>
              openSubscreen('new-timeline-event', {
                classId: cls.id,
                studentId: student.id,
              })
            }
            className="flex items-center gap-1 text-[12px] font-bold text-gm"
          >
            <Plus size={14} />
            Marco
          </button>
        </div>
        {timeline.length === 0 && (
          <p className="text-[12px] text-muted leading-[1.6] mb-8">
            Nenhum marco registrado ainda. Use o botão Marco para adicionar o primeiro registro.
          </p>
        )}
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
                    <a href={event.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-3">
                      <img
                        src={event.attachmentUrl}
                        alt=""
                        className="w-full max-h-56 object-cover rounded-app-sm border border-border"
                      />
                    </a>
                  )}
                  {event.attachmentUrl && event.attachmentKind === 'file' && (
                    <a
                      href={event.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center gap-2 rounded-app-sm border border-gp bg-gbg px-3 py-3 text-[12px] font-bold text-gm"
                    >
                      <FileText size={15} />
                      <span className="flex-1 truncate">{event.attachmentName ?? 'Anexo privado'}</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {event.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-[2px] rounded-full bg-cream text-muted border border-border">{tag}</span>
                      ))}
                    </div>
                  )}
                  {event.attachmentName && !event.attachmentUrl && (
                    <p className="text-[10px] text-muted mt-2">Anexo privado: {event.attachmentName}</p>
                  )}
                  <p className="text-[10px] text-muted mt-2">{event.date}</p>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleDeleteTimelineEvent(event.id)}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-[#C1440E] ml-auto"
                    >
                      <Trash2 size={13} />
                      Excluir
                    </button>
                  </div>
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

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data não informada'
  return date.toLocaleDateString('pt-BR')
}

function formatReviewStatus(status?: string | null) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Corrigir'
  return 'Aguardando aprovação'
}

function getReviewStatusClass(status?: string | null) {
  if (status === 'approved') return 'bg-gbg text-gd border border-gp'
  if (status === 'changes_requested') return 'bg-[#FFF1F1] text-[#C1440E] border border-[#F3C0B1]'
  return 'bg-[#FFF3CD] text-[#856404] border border-[#EAD58A]'
}

function formatReviewAction(action: string) {
  if (action === 'approve') return 'Relatório aprovado'
  if (action === 'request_changes') return 'Correção solicitada'
  if (action === 'comment') return 'Observação registrada'
  return action
}

function formatStudentAge(years?: number, months?: number) {
  const safeYears = typeof years === 'number' ? years : 0
  const safeMonths = typeof months === 'number' ? months : 0
  if (safeMonths > 0) return `${safeYears} anos e ${safeMonths} meses`
  return `${safeYears} anos`
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
