import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { createSupabaseClass } from '@/services/supabase/classes'
import type { ClassData } from '@/types'

const AGE_GROUPS = ['Bercario I', 'Bercario II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II', 'Pre-escola']
const SHIFTS = ['Manha', 'Tarde', 'Integral']

export default function NewClassSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { schoolName, addClass, setActiveClass } = useAppStore()
  const [name, setName] = useState('')
  const [school, setSchool] = useState(schoolName)
  const [shift, setShift] = useState(SHIFTS[0])
  const [ageGroup, setAgeGroup] = useState(AGE_GROUPS[2])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = name.trim().length >= 2 && school.trim().length >= 2

  async function saveClass() {
    if (!canSave) return
    setSaving(true)
    setError('')

    try {
      const input = {
        name: name.trim(),
        school: school.trim(),
        shift,
        ageGroup,
        notes: notes.trim() || undefined,
      }
      const newClass: ClassData = isSupabaseAuthEnabled()
        ? await createSupabaseClass(input)
        : {
            id: `class-${Date.now()}`,
            ...input,
            iconBg: '#D8F3DC',
            students: [],
          }

      addClass(newClass)
      setActiveClass(newClass.id)
      closeSubscreen()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar a turma.')
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
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">Nova turma</span>
          <span className="text-[11px] text-muted">Organize uma sala antes de adicionar as criancas.</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-[16px] pb-[26px]">
        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Nome da turma</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          placeholder="Ex: Maternal II A"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Escola</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          placeholder="Nome da escola"
          value={school}
          onChange={(event) => setSchool(event.target.value)}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Periodo</label>
        <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
          {SHIFTS.map((item) => (
            <button
              key={item}
              onClick={() => setShift(item)}
              className={`rounded-app-sm border px-2 py-3 text-xs font-bold ${
                shift === item ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Faixa etaria</label>
        <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
          {AGE_GROUPS.map((item) => (
            <button
              key={item}
              onClick={() => setAgeGroup(item)}
              className={`rounded-app-sm border px-2 py-3 text-xs font-bold ${
                ageGroup === item ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Observacoes gerais</label>
        <textarea
          className="w-full min-h-[104px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
          placeholder="Rotina, combinados, necessidades da turma..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        {error && <p className="text-[12px] text-[#C1440E] mt-3 leading-[1.5]">{error}</p>}
      </div>

      <div className="p-[18px] bg-white border-t border-border flex-shrink-0 shadow-card" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={saveClass}
          disabled={!canSave || saving}
          className="w-full bg-gm text-white rounded-app-sm py-[13px] text-[14px] font-bold disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar turma'}
        </button>
      </div>
    </div>
  )
}
