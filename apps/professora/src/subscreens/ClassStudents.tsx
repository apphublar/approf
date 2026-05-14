import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BarChart3, CalendarDays, Check, ChevronLeft, ClipboardCheck, Pencil, Users } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { getAdjustedPhotoStyle } from '@/utils/photo'
import type { AttendanceRecord, Student } from '@/types'

type StudentFilter = 'all' | 'atypical' | 'report'
type ClassTool = 'students' | 'attendance' | 'calendar' | 'report'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function ClassStudentsSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, activeClassId, setActiveStudent, attendanceRecords, saveAttendanceRecord } = useAppStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StudentFilter>('all')
  const [activeTool, setActiveTool] = useState<ClassTool>('students')
  const [attendanceDate, setAttendanceDate] = useState(getTodayKey())
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayKey())
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([])
  const [savedMessage, setSavedMessage] = useState('')

  const cls = classes.find((c) => c.id === activeClassId) ?? classes[0]
  const classAttendanceRecords = useMemo(
    () => attendanceRecords.filter((record) => record.classId === cls?.id),
    [attendanceRecords, cls?.id],
  )
  const attendanceByDate = useMemo(
    () => new Map(classAttendanceRecords.map((record) => [record.date, record])),
    [classAttendanceRecords],
  )
  const currentAttendanceRecord = attendanceByDate.get(attendanceDate)

  useEffect(() => {
    setPresentStudentIds(currentAttendanceRecord?.presentStudentIds ?? [])
  }, [currentAttendanceRecord])

  if (!cls) return null

  const filteredStudents = cls.students.filter((student) => {
    const matchesQuery = student.name.toLowerCase().includes(query.toLowerCase())
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'atypical'
          ? Boolean(student.tag)
          : student.annotationCount >= 5

    return matchesQuery && matchesFilter
  })
  const reportRows = buildAttendanceReport(cls.students, classAttendanceRecords)
  const selectedCalendarRecord = attendanceByDate.get(selectedCalendarDate)

  function openStudent(id: string) {
    setActiveStudent(id)
    openSubscreen('student-profile')
  }

  function toggleStudent(studentId: string) {
    setSavedMessage('')
    setPresentStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    )
  }

  function markAllPresent() {
    setSavedMessage('')
    setPresentStudentIds(cls.students.map((student) => student.id))
  }

  function clearAttendance() {
    setSavedMessage('')
    setPresentStudentIds([])
  }

  function saveAttendance() {
    saveAttendanceRecord({
      classId: cls.id,
      date: attendanceDate,
      presentStudentIds,
    })
    setSelectedCalendarDate(attendanceDate)
    setMonthDate(startOfMonth(parseDateKey(attendanceDate)))
    setSavedMessage('Chamada registrada com sucesso.')
  }

  const absentCount = Math.max(cls.students.length - presentStudentIds.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="font-serif text-[18px] text-gd block truncate">{cls.name}</span>
          <span className="text-[11px] text-muted">{cls.shift} · {cls.school}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openSubscreen('edit-class')}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-gm bg-white"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => openSubscreen('new-student')}
            className="bg-gm text-white text-xs font-bold px-[11px] py-[7px] rounded-full"
          >
            + Aluno
          </button>
        </div>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="grid grid-cols-4 gap-2 mt-[14px] mb-4">
          {[
            { id: 'students', label: 'Alunos', icon: Users },
            { id: 'attendance', label: 'Chamada', icon: ClipboardCheck },
            { id: 'calendar', label: 'Calendario', icon: CalendarDays },
            { id: 'report', label: 'Relatorio', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon
            const active = activeTool === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTool(item.id as ClassTool)}
                className={`min-h-[64px] rounded-app-sm border px-2 py-2 flex flex-col items-center justify-center gap-1 ${
                  active ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
                }`}
              >
                <Icon size={17} />
                <span className="text-[10px] font-bold leading-tight">{item.label}</span>
              </button>
            )
          })}
        </div>

        {activeTool === 'students' && (
          <>
            <div className="bg-white rounded-app-sm border border-border px-3 py-2 mb-[10px]">
              <input
                className="w-full bg-transparent outline-none text-[13px] text-ink"
                placeholder="Buscar aluno..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex gap-[7px] overflow-x-auto pb-[6px] mb-[10px] scrollbar-none">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'atypical', label: 'Atipicos' },
                { id: 'report', label: 'Com relatorio' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id as StudentFilter)}
                  className={`px-[13px] py-[6px] rounded-full text-xs font-semibold border-[1.5px] whitespace-nowrap flex-shrink-0 ${
                    filter === item.id ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mt-[14px] mb-[10px]">
              {filteredStudents.length} de {cls.students.length} alunos
            </p>
            {filteredStudents.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                rightSlot={
                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-semibold text-gm">{student.annotationCount}</span>
                    <span className="text-[10px] text-muted block">anotacoes</span>
                  </div>
                }
                onClick={() => openStudent(student.id)}
              />
            ))}
          </>
        )}

        {activeTool === 'attendance' && (
          <div className="pb-8">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-[13px] bg-gbg border border-gp flex items-center justify-center text-gm">
                  <ClipboardCheck size={20} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Lista de chamada</h2>
                  <p className="text-[12px] text-muted leading-snug">Marque quem veio. Quem ficar sem marca sera registrado como falta.</p>
                </div>
              </div>
              <input
                type="date"
                value={attendanceDate}
                onChange={(event) => {
                  setSavedMessage('')
                  setAttendanceDate(event.target.value)
                }}
                className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 text-[14px] text-ink outline-none"
              />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <SummaryPill label="Presentes" value={presentStudentIds.length} tone="good" />
                <SummaryPill label="Faltas" value={absentCount} tone="warn" />
                <SummaryPill label="Alunos" value={cls.students.length} tone="neutral" />
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={markAllPresent} className="flex-1 rounded-app-sm bg-gbg text-gd border border-gp py-3 text-xs font-bold">
                Todos presentes
              </button>
              <button onClick={clearAttendance} className="flex-1 rounded-app-sm bg-white text-muted border border-border py-3 text-xs font-bold">
                Limpar marcas
              </button>
            </div>

            <div className="flex flex-col gap-[9px]">
              {cls.students.map((student) => {
                const present = presentStudentIds.includes(student.id)
                return (
                  <StudentRow
                    key={student.id}
                    student={student}
                    onClick={() => toggleStudent(student.id)}
                    rightSlot={
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        present ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
                      }`}>
                        {present ? <Check size={18} /> : <span className="text-[10px] font-bold">Falta</span>}
                      </div>
                    }
                  />
                )
              })}
            </div>

            {savedMessage && (
              <p className="text-[12px] font-bold text-gm text-center mt-4">{savedMessage}</p>
            )}
            <button onClick={saveAttendance} className="w-full mt-4 py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none">
              Salvar chamada
            </button>
          </div>
        )}

        {activeTool === 'calendar' && (
          <div className="pb-8">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setMonthDate(addMonths(monthDate, -1))} className="w-9 h-9 rounded-full border border-border text-muted bg-white">
                  ‹
                </button>
                <div className="text-center">
                  <p className="font-serif text-[19px] text-gd capitalize">{formatMonthTitle(monthDate)}</p>
                  <p className="text-[11px] text-muted">{classAttendanceRecords.length} chamadas registradas</p>
                </div>
                <button onClick={() => setMonthDate(addMonths(monthDate, 1))} className="w-9 h-9 rounded-full border border-border text-muted bg-white">
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((day, index) => (
                  <span key={`${day}-${index}`} className="text-center text-[10px] font-bold text-muted py-1">{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {buildCalendarDays(monthDate).map((day, index) => {
                  const record = day ? attendanceByDate.get(day.key) : undefined
                  const selected = day?.key === selectedCalendarDate
                  return (
                    <button
                      key={day?.key ?? `blank-${index}`}
                      disabled={!day}
                      onClick={() => day && setSelectedCalendarDate(day.key)}
                      className={`aspect-square rounded-[8px] border text-[12px] font-bold relative ${
                        !day
                          ? 'border-transparent bg-transparent'
                          : selected
                            ? 'bg-gd border-gd text-white'
                            : record
                              ? 'bg-gbg border-gp text-gd'
                              : 'bg-cream border-border text-muted'
                      }`}
                    >
                      {day?.label}
                      {record && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-gm'}`} />}
                    </button>
                  )
                })}
              </div>
            </div>

            <AttendanceDayDetails
              date={selectedCalendarDate}
              record={selectedCalendarRecord}
              students={cls.students}
              onEdit={() => {
                setAttendanceDate(selectedCalendarDate)
                setActiveTool('attendance')
              }}
            />
          </div>
        )}

        {activeTool === 'report' && (
          <div className="pb-8">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[13px] bg-gbg border border-gp flex items-center justify-center text-gm">
                  <BarChart3 size={20} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Relatorio de frequencia</h2>
                  <p className="text-[12px] text-muted leading-snug">
                    Resumo baseado em {classAttendanceRecords.length} chamadas registradas para esta turma.
                  </p>
                </div>
              </div>
            </div>

            {reportRows.length > 0 ? (
              <div className="flex flex-col gap-[10px]">
                {reportRows.map((row) => (
                  <div key={row.student.id} className="bg-white rounded-app p-3 border border-border shadow-card">
                    <div className="flex items-center gap-3">
                      <StudentAvatar student={row.student} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-ink truncate">{row.student.name}</p>
                        <p className="text-[11px] text-muted">{row.presences} presencas · {row.absences} faltas</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[15px] font-bold text-gm">{row.rate}%</span>
                        <span className="text-[10px] block text-muted">presenca</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-cream overflow-hidden mt-3">
                      <div className="h-full rounded-full bg-gm" style={{ width: `${row.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
                <CalendarDays size={22} className="text-gm mx-auto mb-2" />
                <p className="text-[13px] font-bold text-ink">Nenhuma chamada registrada</p>
                <p className="text-[12px] text-muted mt-1 leading-[1.5]">Registre a primeira lista de chamada para ver o relatorio.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StudentRow({ student, rightSlot, onClick }: { student: Student; rightSlot: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-app px-[15px] py-[13px] border border-border shadow-card flex items-center gap-[13px] active:scale-[.98] transition-transform"
    >
      <StudentAvatar student={student} />
      <div className="flex-1 text-left min-w-0">
        <p className="text-[14px] font-semibold text-ink truncate">{student.name}</p>
        <p className="text-[11px] text-muted">{student.age} anos {student.tag ? `· ${student.tag}` : ''}</p>
      </div>
      {rightSlot}
      <span className="text-muted text-[19px] ml-1">›</span>
    </button>
  )
}

function StudentAvatar({ student }: { student: Student }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0 overflow-hidden"
      style={{ background: student.avatarBg, color: student.avatarFg }}
    >
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
  )
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' | 'neutral' }) {
  const styles = {
    good: 'bg-gbg border-gp text-gd',
    warn: 'bg-[#FFF3CD] border-[#EAD58A] text-[#856404]',
    neutral: 'bg-cream border-border text-muted',
  }

  return (
    <div className={`rounded-app-sm border px-2 py-3 text-center ${styles[tone]}`}>
      <span className="block text-[18px] font-bold leading-none">{value}</span>
      <span className="block text-[10px] font-bold mt-1">{label}</span>
    </div>
  )
}

function AttendanceDayDetails({
  date,
  record,
  students,
  onEdit,
}: {
  date: string
  record?: AttendanceRecord
  students: Student[]
  onEdit: () => void
}) {
  const presentIds = record?.presentStudentIds ?? []
  const absentStudents = students.filter((student) => !presentIds.includes(student.id))
  const presentStudents = students.filter((student) => presentIds.includes(student.id))

  return (
    <div className="bg-white rounded-app p-4 border border-border shadow-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-serif text-[19px] text-gd">{formatDateTitle(date)}</p>
          <p className="text-[12px] text-muted mt-1">
            {record ? `${presentStudents.length} presentes · ${absentStudents.length} faltas` : 'Sem chamada registrada'}
          </p>
        </div>
        <button onClick={onEdit} className="px-3 py-2 rounded-full bg-gm text-white text-xs font-bold">
          {record ? 'Editar' : 'Fazer chamada'}
        </button>
      </div>

      {record ? (
        <div className="grid grid-cols-2 gap-3">
          <StudentNameList title="Presentes" students={presentStudents} empty="Nenhum presente marcado" />
          <StudentNameList title="Faltas" students={absentStudents} empty="Nenhuma falta" />
        </div>
      ) : (
        <p className="text-[12px] text-muted leading-[1.6]">
          Selecione fazer chamada para registrar as presencas desta data.
        </p>
      )}
    </div>
  )
}

function StudentNameList({ title, students, empty }: { title: string; students: Student[]; empty: string }) {
  return (
    <div className="rounded-app-sm bg-cream border border-border p-3">
      <p className="text-[11px] font-bold text-ink mb-2">{title}</p>
      {students.length > 0 ? (
        <div className="flex flex-col gap-1">
          {students.map((student) => (
            <span key={student.id} className="text-[11px] text-muted leading-snug">{student.name}</span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted leading-snug">{empty}</p>
      )}
    </div>
  )
}

function buildAttendanceReport(students: Student[], records: AttendanceRecord[]) {
  if (records.length === 0) return []

  return students
    .map((student) => {
      const presences = records.filter((record) => record.presentStudentIds.includes(student.id)).length
      const absences = records.length - presences
      const rate = Math.round((presences / records.length) * 100)

      return { student, presences, absences, rate }
    })
    .sort((a, b) => b.absences - a.absences || b.presences - a.presences || a.student.name.localeCompare(b.student.name))
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  const days: Array<{ key: string; label: number } | null> = []

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null)
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day)
    days.push({ key: formatDateKey(date), label: day })
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function getTodayKey() {
  return formatDateKey(new Date())
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function formatDateTitle(dateKey: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(parseDateKey(dateKey))
}
