import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { createSupabaseCalendarEvent, loadSupabaseCalendarEvents } from '@/services/supabase/calendar'
import { getPedagogicalDates, toIsoDate } from '@/utils/pedagogical-calendar'

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export default function CalendarSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { calendarEvents, addCalendarEvent, setCalendarEvents } = useAppStore()
  const today = new Date()
  const [visibleDate, setVisibleDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(today))
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [remind, setRemind] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const year = visibleDate.getFullYear()
  const month = visibleDate.getMonth()
  const pedagogicalDates = useMemo(() => getPedagogicalDates(year), [year])
  const selectedPedagogicalDates = pedagogicalDates.filter((event) => event.date === selectedDate)
  const selectedUserEvents = calendarEvents
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  const dayCells = useMemo(() => buildMonthCells(year, month), [year, month])

  useEffect(() => {
    if (!isSupabaseAuthEnabled()) return

    loadSupabaseCalendarEvents()
      .then(setCalendarEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.'))
  }, [setCalendarEvents])

  function changeMonth(direction: -1 | 1) {
    setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  async function createEvent() {
    if (!title.trim()) return
    setSaving(true)
    setError('')

    try {
      const input = {
        date: selectedDate,
        title: title.trim(),
        time: time || undefined,
        notes: notes.trim() || undefined,
        remind,
      }
      const event = isSupabaseAuthEnabled()
        ? await createSupabaseCalendarEvent(input)
        : { id: `cal-${Date.now()}`, ...input }

      addCalendarEvent(event)
      setTitle('')
      setTime('')
      setNotes('')
      setRemind(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o evento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Calendário pedagógico</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="flex items-center justify-between mt-[16px] mb-[14px]">
          <button onClick={() => changeMonth(-1)} className="w-9 h-9 rounded-full bg-white border border-border text-gm flex items-center justify-center">
            <ChevronLeft size={17} />
          </button>
          <h2 className="font-serif text-[21px] text-gd">{MONTHS[month]} {year}</h2>
          <button onClick={() => changeMonth(1)} className="w-9 h-9 rounded-full bg-white border border-border text-gm flex items-center justify-center">
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="bg-white rounded-app border border-border shadow-card p-3 mb-5">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day) => (
              <span key={day} className="text-center text-[10px] font-bold text-muted py-1">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dayCells.map((cell) => {
              const userCount = calendarEvents.filter((event) => event.date === cell.iso).length
              const pedagogicalCount = pedagogicalDates.filter((event) => event.date === cell.iso).length
              const selected = selectedDate === cell.iso
              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedDate(cell.iso)}
                  className="aspect-square rounded-[10px] text-[12px] font-semibold relative"
                  style={{
                    background: selected ? '#1B4332' : cell.inMonth ? '#fff' : '#F7F4EE',
                    color: selected ? '#fff' : cell.inMonth ? '#1A1A1A' : '#B6B1A8',
                    border: userCount || pedagogicalCount ? '1px solid #C2E8A0' : '1px solid transparent',
                  }}
                >
                  {cell.day}
                  {(userCount > 0 || pedagogicalCount > 0) && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-[2px]">
                      {pedagogicalCount > 0 && <span className="w-1 h-1 rounded-full bg-gl" />}
                      {userCount > 0 && <span className="w-1 h-1 rounded-full bg-[#C1440E]" />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <section className="bg-white rounded-app border border-border shadow-card p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Data selecionada</p>
              <h3 className="text-[15px] font-bold text-ink mt-1">{formatDate(selectedDate)}</h3>
            </div>
            <span className="text-[11px] font-bold text-gm bg-gbg border border-gp rounded-full px-3 py-1">
              {selectedUserEvents.length + selectedPedagogicalDates.length} itens
            </span>
          </div>

          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mb-3 text-[14px] outline-none"
            placeholder="Título do evento"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
            <input
              className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 text-[14px] outline-none"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            <button
              onClick={() => setRemind((current) => !current)}
              className="rounded-app-sm border px-3 flex items-center gap-2 text-[12px] font-bold"
              style={{ background: remind ? '#F0FAF4' : '#fff', borderColor: remind ? '#4F8341' : '#D4EBC8', color: remind ? '#4F8341' : '#9A9A9A' }}
            >
              <Bell size={14} />
              Alerta
            </button>
          </div>
          <textarea
            className="w-full min-h-[78px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mb-3 text-[14px] outline-none"
            placeholder="Observações opcionais"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <button
            onClick={createEvent}
            disabled={!title.trim() || saving}
            className="w-full bg-gm text-white rounded-app-sm py-[12px] text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={15} />
            {saving ? 'Salvando...' : 'Criar evento'}
          </button>
          {error && <p className="text-[12px] text-[#C1440E] mt-3 leading-[1.5]">{error}</p>}
        </section>

        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">Eventos do dia</p>
        {selectedPedagogicalDates.map((event) => (
          <EventCard key={event.id} title={event.title} desc={event.kind === 'holiday' ? 'Data oficial' : 'Data pedagógica'} tone="green" />
        ))}
        {selectedUserEvents.map((event) => (
          <EventCard
            key={event.id}
            title={event.title}
            desc={`${event.time ? `${event.time} - ` : ''}${event.remind ? 'Com alerta' : 'Sem alerta'}${event.notes ? ` - ${event.notes}` : ''}`}
            tone="orange"
          />
        ))}
        {selectedPedagogicalDates.length === 0 && selectedUserEvents.length === 0 && (
          <div className="bg-white rounded-app p-4 border border-border shadow-card mb-[10px]">
            <p className="text-[13px] font-bold text-ink">Nenhum evento nesta data.</p>
            <p className="text-[11px] text-muted mt-1">Toque em uma data e crie um evento para organizar a rotina.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      day: date.getDate(),
      iso: toIsoDate(date),
      inMonth: date.getMonth() === month,
    }
  })
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function EventCard({ title, desc, tone }: { title: string; desc: string; tone: 'green' | 'orange' }) {
  return (
    <div className="bg-white rounded-app p-4 border border-border shadow-card mb-[10px]">
      <div className="flex items-start gap-3">
        <span
          className="w-2 h-2 rounded-full mt-[6px] flex-shrink-0"
          style={{ background: tone === 'green' ? '#83C451' : '#C1440E' }}
        />
        <div>
          <h3 className="text-[13px] font-bold text-ink">{title}</h3>
          <p className="text-[11px] text-muted mt-1 leading-[1.5]">{desc}</p>
        </div>
      </div>
    </div>
  )
}
