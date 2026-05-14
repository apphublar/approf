import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, FileUp } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { createSupabaseTimelineEvent } from '@/services/supabase/timeline'
import type { TimelineEvent, TimelineEventType } from '@/types'

const EVENT_TYPES: { id: TimelineEventType; label: string; desc: string }[] = [
  { id: 'evolucao', label: 'Evolucao', desc: 'Progresso observado na rotina.' },
  { id: 'atividade', label: 'Atividade', desc: 'Vivencia ou proposta pedagogica.' },
  { id: 'emocao', label: 'Emocao', desc: 'Expressao emocional e acolhimento.' },
  { id: 'alimentacao', label: 'Alimentacao', desc: 'Rotina alimentar e experimentacoes.' },
  { id: 'socializacao', label: 'Socializacao', desc: 'Interacoes com pares e adultos.' },
  { id: 'desenvolvimento', label: 'Desenvolvimento', desc: 'Linguagem, corpo, autonomia.' },
  { id: 'foto', label: 'Foto', desc: 'Registro visual privado.' },
  { id: 'marco', label: 'Marco especial', desc: 'Momento importante da jornada.' },
]

const QUICK_TAGS = ['Linguagem', 'Autonomia', 'Acolhimento', 'Brincadeira', 'Movimento', 'Musicalizacao', 'Rotina', 'Familia']
const MAX_ATTACHMENT_SIZE_MB = 10
const ACCEPTED_ATTACHMENT_TYPES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export default function NewTimelineEventSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeClassId, activeStudentId, addTimelineEvent } = useAppStore()
  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const student = cls?.students.find((item) => item.id === activeStudentId) ?? cls?.students[0]

  const [type, setType] = useState<TimelineEventType>('evolucao')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    }
  }, [attachmentPreviewUrl])

  if (!cls || !student) return null

  const canSave = title.trim().length >= 2 && text.trim().length >= 5

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  function selectFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError('')
    if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
      setError(`O arquivo precisa ter ate ${MAX_ATTACHMENT_SIZE_MB} MB.`)
      return
    }
    if (!ACCEPTED_ATTACHMENT_TYPES.some((type) => file.type.startsWith(type) || file.type === type)) {
      setError('Use imagem, PDF, Word ou TXT.')
      return
    }

    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    setAttachmentFile(file)
    setAttachmentName(file.name)
    setAttachmentPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  async function saveEvent() {
    if (!canSave) return
    setSaving(true)
    setError('')

    try {
      const event: TimelineEvent = isSupabaseAuthEnabled()
        ? await createSupabaseTimelineEvent({
            studentId: student.id,
            type,
            title: title.trim(),
            text: text.trim(),
            tags,
            attachmentFile,
          })
        : {
            id: `tl-${Date.now()}`,
            type,
            title: title.trim(),
            text: text.trim(),
            date: 'Hoje',
            tags,
            attachmentName,
            attachmentUrl: attachmentPreviewUrl,
            attachmentKind: attachmentPreviewUrl ? 'image' : attachmentName ? 'file' : undefined,
          }

      addTimelineEvent(cls.id, student.id, event)
      closeSubscreen()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar o marco.')
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
          <span className="font-serif text-[18px] text-gd block">Novo marco</span>
          <span className="text-[11px] text-muted">{student.name} - memoria pedagogica</span>
        </div>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-2">Tipo de registro</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {EVENT_TYPES.map((item) => (
            <button
              key={item.id}
              onClick={() => setType(item.id)}
              className={`rounded-app-sm border px-3 py-3 text-left ${
                type === item.id ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
              }`}
            >
              <span className="block text-xs font-bold">{item.label}</span>
              <span className="block text-[10px] opacity-75 mt-1 leading-tight">{item.desc}</span>
            </button>
          ))}
        </div>

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Titulo</label>
        <input
          className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
          placeholder="Ex: primeira pintura com tinta"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Registro da professora</label>
        <textarea
          className="w-full min-h-[132px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none leading-[1.6]"
          placeholder="Descreva o que aconteceu, o contexto, como a crianca reagiu e por que esse momento importa."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-2">Tags rapidas</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${
                tags.includes(tag) ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-gbg flex items-center justify-center text-gm flex-shrink-0">
              <FileUp size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-ink">Foto ou documento opcional</p>
              <p className="text-[11px] text-muted leading-[1.5] mt-1">
                Arquivos de criancas ficam privados no Supabase Storage.
              </p>
              {attachmentName && <p className="text-[12px] text-soft bg-cream rounded-app-sm px-3 py-2 mt-3">{attachmentName}</p>}
              {attachmentPreviewUrl && (
                <img
                  src={attachmentPreviewUrl}
                  alt=""
                  className="mt-3 w-full max-h-44 object-cover rounded-app-sm border border-border"
                />
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(event) => selectFile(event.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full mt-3 py-[11px] rounded-app-sm border-[1.5px] border-dashed border-border text-muted text-sm font-bold bg-white"
          >
            + Anexar arquivo
          </button>
        </div>
        {error && <p className="text-[12px] text-[#C1440E] mb-4 leading-[1.5]">{error}</p>}
      </div>

      <div className="p-[18px] bg-white border-t border-border flex-shrink-0">
        <button
          onClick={saveEvent}
          disabled={!canSave || saving}
          className="w-full bg-gm text-white rounded-app-sm py-[13px] text-[14px] font-bold disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar na timeline'}
        </button>
      </div>
    </div>
  )
}
