import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { updateSupabaseClass } from '@/services/supabase/classes'
import AgeRangeSelector from '@/components/ui/AgeRangeSelector'

const SHIFTS = ['Manha', 'Tarde', 'Integral']

export default function EditClassSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeClassId, updateClass } = useAppStore()
  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]

  const [name, setName] = useState(cls?.name ?? '')
  const [school, setSchool] = useState(cls?.school ?? '')
  const [shift, setShift] = useState(cls?.shift ?? SHIFTS[0])
  const [ageGroup, setAgeGroup] = useState(cls?.ageGroup ?? '0 a 5 anos')
  const [notes, setNotes] = useState(cls?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!cls) return null

  const canSave = name.trim().length >= 2 && school.trim().length >= 2

  async function saveClass() {
    if (!canSave) return
    setSaving(true)
    setError('')

    const updates = {
      name: name.trim(),
      school: school.trim(),
      shift,
      ageGroup,
      notes: notes.trim() || undefined,
    }

    try {
      if (isSupabaseAuthEnabled()) {
        await updateSupabaseClass(cls.id, updates)
      }
      updateClass(cls.id, updates)
      closeSubscreen()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar as alteracoes.')
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
          <span className="font-serif text-[18px] text-gd block">Editar turma</span>
          <span className="text-[11px] text-muted">Ajuste dados da rotina pedagogica.</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-[16px] pb-[26px]">
        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Nome da turma</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Escola</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
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
        <AgeRangeSelector value={ageGroup} onChange={setAgeGroup} />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Observacoes gerais</label>
        <textarea
          className="w-full min-h-[104px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
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
          {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </div>
    </div>
  )
}
