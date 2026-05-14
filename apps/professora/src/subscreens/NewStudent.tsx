import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ImagePlus } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { createSupabaseStudent } from '@/services/supabase/students'
import type { Student } from '@/types'
import { birthDateInputToIso, formatBirthDateInput } from '@/utils/date'
import { getAdjustedPhotoStyle, serializePhotoAdjustment } from '@/utils/photo'

const TAGS = ['Sem tag', 'TEA', 'TDAH', 'Acompanhamento', 'Adaptacao']
const AVATARS = [
  ['#FDE2E4', '#7A2830'],
  ['#D8F3DC', '#245C3F'],
  ['#DDEBFF', '#24507A'],
  ['#FFF1C9', '#725012'],
]

function createChildCode(name: string) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CRI-${prefix}-${suffix}`
}

function calculateAgeParts(birthDate: string) {
  if (!birthDate) return { years: 0, months: 0 }
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()

  if (today.getDate() < birth.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  return { years: Math.max(0, Math.min(5, years)), months: Math.max(0, months) }
}

export default function NewStudentSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeClassId, addStudent, setActiveStudent } = useAppStore()
  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const [name, setName] = useState('')
  const [birthDateInput, setBirthDateInput] = useState('')
  const [tag, setTag] = useState(TAGS[0])
  const [generalNotes, setGeneralNotes] = useState('')
  const [photoName, setPhotoName] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoPositionX, setPhotoPositionX] = useState(50)
  const [photoPositionY, setPhotoPositionY] = useState(50)
  const [photoZoom, setPhotoZoom] = useState(120)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  if (!cls) return null

  const canSave = name.trim().length >= 2

  function choosePhoto() {
    photoInputRef.current?.click()
  }

  function handlePhotoChange(file?: File) {
    if (!file) return
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoName(file.name)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  async function saveStudent() {
    if (!canSave) return
    setSaving(true)
    setError('')

    try {
      const selectedTag = tag === 'Sem tag' ? null : tag
      const notes = generalNotes.trim() || undefined
      const photoPosition = serializePhotoAdjustment({ x: photoPositionX, y: photoPositionY, zoom: photoZoom })
      const birthDate = birthDateInputToIso(birthDateInput)
      if (birthDate === null) {
        setError('Informe a data de nascimento no formato dia/mes/ano, como 14/03/2021.')
        setSaving(false)
        return
      }
      const student: Student = isSupabaseAuthEnabled()
        ? await createSupabaseStudent({
            classId: cls.id,
            name: name.trim(),
            birthDate: birthDate || undefined,
            tag: selectedTag,
            generalNotes: notes,
            photoFile,
            photoPosition,
          })
        : createLocalStudent({
            name: name.trim(),
            birthDate,
            tag: selectedTag,
            generalNotes: notes,
            photoUrl: photoPreviewUrl,
            photoPosition,
          })

      addStudent(cls.id, student)
      setActiveStudent(student.id)
      closeSubscreen()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar a crianca.')
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
          <span className="font-serif text-[18px] text-gd block">Nova crianca</span>
          <span className="text-[11px] text-muted">{cls.name}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-[16px] pb-[26px]">
        <div className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
          <input
            ref={photoInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => handlePhotoChange(event.target.files?.[0])}
          />
          <button
            onClick={choosePhoto}
            className="w-full border-[1.5px] border-dashed border-border rounded-app-sm py-5 flex flex-col items-center gap-3 text-muted"
          >
            {photoPreviewUrl ? (
              <span className="w-24 h-24 rounded-full overflow-hidden border-2 border-gp bg-cream block">
                <img
                  src={photoPreviewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={getAdjustedPhotoStyle(serializePhotoAdjustment({ x: photoPositionX, y: photoPositionY, zoom: photoZoom }))}
                />
              </span>
            ) : (
              <ImagePlus size={22} />
            )}
            <span className="text-xs font-bold">{photoName ?? 'Adicionar foto opcional'}</span>
          </button>
          {photoPreviewUrl && (
            <div className="mt-4 space-y-3">
              <PhotoPositionSlider label="Zoom" min={100} max={240} value={photoZoom} onChange={setPhotoZoom} />
              <PhotoPositionSlider label="Mover para os lados" value={photoPositionX} onChange={setPhotoPositionX} />
              <PhotoPositionSlider label="Mover para cima/baixo" value={photoPositionY} onChange={setPhotoPositionY} />
            </div>
          )}
          <p className="text-[11px] text-muted mt-3">
            A foto fica privada e aparece em formato redondo no perfil da crianca.
          </p>
        </div>

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Nome</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          placeholder="Nome da crianca"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Data de nascimento</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          inputMode="numeric"
          maxLength={10}
          placeholder="Ex: 14/03/2021"
          value={birthDateInput}
          onChange={(event) => setBirthDateInput(formatBirthDateInput(event.target.value))}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Marcador pedagogico</label>
        <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2 mb-4 pb-1">
          {TAGS.map((item) => (
            <button
              key={item}
              onClick={() => setTag(item)}
              className={`px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${
                tag === item ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Observacoes gerais</label>
        <textarea
          className="w-full min-h-[124px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
          placeholder="Preferencias, rotina, acolhimento, informacoes importantes..."
          value={generalNotes}
          onChange={(event) => setGeneralNotes(event.target.value)}
        />
        {error && <p className="text-[12px] text-[#C1440E] mt-3 leading-[1.5]">{error}</p>}
      </div>

      <div className="p-[18px] bg-white border-t border-border flex-shrink-0 shadow-card" style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={saveStudent}
          disabled={!canSave || saving}
          className="w-full bg-gm text-white rounded-app-sm py-[13px] text-[14px] font-bold disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar crianca'}
        </button>
      </div>
    </div>
  )
}

function createLocalStudent(input: {
  name: string
  birthDate: string
  tag: string | null
  generalNotes?: string
  photoUrl?: string | null
  photoPosition?: string
}): Student {
  const age = calculateAgeParts(input.birthDate)
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]

  return {
    id: `student-${Date.now()}`,
    childCode: createChildCode(input.name),
    name: input.name,
    age: age.years,
    ageMonths: age.months,
    birthDate: input.birthDate || undefined,
    tag: input.tag,
    generalNotes: input.generalNotes,
    photoUrl: input.photoUrl ?? null,
    photoPosition: input.photoPosition,
    avatarBg: avatar[0],
    avatarFg: avatar[1],
    annotationCount: 0,
    development: {
      linguagem: 0,
      socializacao: 0,
      coordenacao: 0,
      autonomia: 0,
    },
    timeline: [],
  }
}

function PhotoPositionSlider({
  label,
  min = 0,
  max = 100,
  value,
  onChange,
}: {
  label: string
  min?: number
  max?: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-2">
        <span>{label}</span>
        <span>{value}%</span>
      </span>
      <input
        className="w-full accent-gm"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
