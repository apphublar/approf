import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Check, Mic, Paperclip, Square } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import { formatAiUsageMessage, transcribeAnnotationAudio } from '@/services/ai-usage'
import { createSupabaseAnnotation } from '@/services/supabase/annotations'
import { isSupabaseConfigured } from '@/services/supabase/config'
import type { AnnotationCategory, AnnotationPersistence } from '@/types'

type WorkKind = '' | 'report' | 'planning' | 'memory' | 'personal'
type Scope = 'child' | 'class' | 'optional-class' | 'teacher'

interface ModelOption {
  id: string
  label: string
  desc: string
  scope: Scope
}

const REPORT_MODELS: ModelOption[] = [
  { id: 'desenvolvimento', label: 'Relatorio de desenvolvimento', desc: 'Evolucao individual da crianca, sem comparacoes.', scope: 'child' },
  { id: 'atipico', label: 'Relatorio atipico', desc: 'Observacoes pedagogicas, sem diagnostico clinico.', scope: 'child' },
  { id: 'diario', label: 'Diario de bordo', desc: 'Rotina e acontecimentos do grupo ou da crianca.', scope: 'class' },
  { id: 'portfolio', label: 'Portfolio pedagogico', desc: 'Evidencias, producoes, fotos e jornada individual.', scope: 'child' },
  { id: 'especialista', label: 'Relatorio para especialista', desc: 'Neuropediatra, fono, TO, psicologo ou psicopedagogo.', scope: 'child' },
  { id: 'encaminhamento', label: 'Encaminhamento pedagogico', desc: 'Registro para orientar familia ou especialista.', scope: 'child' },
  { id: 'anamnese', label: 'Ficha de anamnese', desc: 'Informacoes iniciais e contexto da crianca.', scope: 'child' },
  { id: 'reuniao-pais', label: 'Registro de reuniao de pais', desc: 'Pontos tratados com a familia.', scope: 'child' },
]

const PLANNING_MODELS: ModelOption[] = [
  { id: 'anual', label: 'Planejamento anual', desc: 'Organizacao ampla do ano letivo.', scope: 'class' },
  { id: 'semestral', label: 'Planejamento semestral', desc: 'Objetivos e propostas do semestre.', scope: 'class' },
  { id: 'mensal', label: 'Planejamento mensal', desc: 'Temas, objetivos e vivencias do mes.', scope: 'class' },
  { id: 'quinzenal', label: 'Planejamento quinzenal', desc: 'Sequencia de atividades para duas semanas.', scope: 'class' },
  { id: 'semanal', label: 'Planejamento semanal', desc: 'Rotina e propostas da semana.', scope: 'class' },
  { id: 'diario', label: 'Plano de aula diario', desc: 'Atividade, objetivo, materiais e desenvolvimento.', scope: 'class' },
  { id: 'projeto', label: 'Projeto pedagogico especifico', desc: 'Projeto por tema, interesse da turma ou necessidade observada.', scope: 'class' },
]

const MEMORY_MODELS: ModelOption[] = [
  { id: 'evolucao', label: 'Evolucao da crianca', desc: 'Marco, progresso, fala, autonomia ou interacao.', scope: 'child' },
  { id: 'observacao', label: 'Observacao importante', desc: 'Algo que precisa acompanhar a rotina pedagogica.', scope: 'child' },
  { id: 'ideia', label: 'Ideia solta para depois', desc: 'Pensamento rapido para usar em relatorio ou planejamento.', scope: 'optional-class' },
]

const PERSONAL_MODELS: ModelOption[] = [
  { id: 'pessoal', label: 'Anotacao pessoal', desc: 'Registro privado da professora, sem vinculo com crianca ou turma.', scope: 'teacher' },
  { id: 'lembrete', label: 'Lembrete de rotina', desc: 'Algo para lembrar depois sobre organizacao, materiais ou combinados.', scope: 'teacher' },
  { id: 'ideia-pessoal', label: 'Ideia para desenvolver', desc: 'Uma ideia livre para amadurecer antes de virar planejamento.', scope: 'teacher' },
]

const TAGS = [
  'Linguagem',
  'Socializacao',
  'Coord. motora',
  'Emocoes',
  'Alimentacao',
  'Sono',
  'Autonomia',
  'Brincadeira',
  'Rotina',
  'Evolucao positiva',
]

const MAX_AUDIO_SECONDS = 30

export default function NewAnnotationSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { addAnnotation, classes, activeClassId, activeStudentId } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const activeStudent = activeClass?.students.find((item) => item.id === activeStudentId)

  const [text, setText] = useState('')
  const [workKind, setWorkKind] = useState<WorkKind>('')
  const [modelId, setModelId] = useState('')
  const [classId, setClassId] = useState(activeClass?.id ?? '')
  const [studentId, setStudentId] = useState(activeStudent?.id ?? '')
  const [tagToAdd, setTagToAdd] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [attachmentName, setAttachmentName] = useState('')
  const [saving, setSaving] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [usageMessage, setUsageMessage] = useState('')
  const [error, setError] = useState('')

  const modelOptions = getModelOptions(workKind)
  const selectedModel = modelOptions.find((item) => item.id === modelId)
  const selectedClass = classes.find((item) => item.id === classId) ?? activeClass
  const selectedStudent = selectedClass?.students.find((item) => item.id === studentId)
  const availableStudents = useMemo(() => selectedClass?.students ?? [], [selectedClass])

  const needsClass = selectedModel?.scope === 'class' || selectedModel?.scope === 'child'
  const needsStudent = selectedModel?.scope === 'child'
  const canSave =
    text.trim().length >= 5 &&
    Boolean(workKind && selectedModel) &&
    (!needsClass || Boolean(classId)) &&
    (!needsStudent || Boolean(studentId))

  useEffect(() => {
    if (!recording) return

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Math.min(MAX_AUDIO_SECONDS, Math.floor((Date.now() - startedAt) / 1000))
      setRecordingSeconds(elapsed)
      if (elapsed >= MAX_AUDIO_SECONDS) {
        stopRecording()
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [recording])

  useEffect(() => () => {
    stopMediaStream()
  }, [])

  function chooseWorkKind(value: WorkKind) {
    setWorkKind(value)
    setModelId('')
    setError('')

    const fallbackClass = activeClass ?? classes[0]
    setClassId(value === 'personal' ? '' : fallbackClass?.id ?? '')
    setStudentId(value === 'personal' ? '' : activeStudent?.id ?? fallbackClass?.students[0]?.id ?? '')
  }

  function chooseModel(value: string) {
    const nextModel = getModelOptions(workKind).find((item) => item.id === value)
    setModelId(value)

    if (nextModel?.scope === 'class' || nextModel?.scope === 'optional-class') {
      setStudentId('')
    }
    if (nextModel?.scope === 'teacher') {
      setClassId('')
      setStudentId('')
    }
    if (nextModel?.scope === 'child' && !studentId) {
      setStudentId(selectedClass?.students[0]?.id ?? '')
    }
  }

  function updateClass(id: string) {
    const nextClass = classes.find((item) => item.id === id)
    setClassId(id)
    setStudentId(selectedModel?.scope === 'child' ? nextClass?.students[0]?.id ?? '' : '')
  }

  function addTag(value: string) {
    if (!value) return
    setTags((current) => current.includes(value) ? current : [...current, value])
    setTagToAdd('')
  }

  function selectFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setAttachmentName(file.name)
  }

  async function startRecording() {
    setError('')
    setUsageMessage('')
    setAudioBlob(null)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador nao permite gravar audio aqui.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        stopMediaStream()
      }

      setRecordingSeconds(0)
      setRecording(true)
      recorder.start()
    } catch {
      setError('Nao foi possivel acessar o microfone. Verifique a permissao do navegador.')
      stopMediaStream()
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setRecording(false)
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
  }

  async function transcribeAudio() {
    if (!audioBlob) {
      setError('Grave um audio antes de transcrever.')
      return
    }

    setTranscribing(true)
    setError('')
    setUsageMessage('')

    try {
      const result = await transcribeAnnotationAudio({
        audio: audioBlob,
        durationSeconds: Math.max(1, recordingSeconds),
        classId: classId || null,
        studentId: studentId || null,
        requestSummary: {
          source: 'new_annotation',
          workKind,
          modelId,
          durationSeconds: Math.max(1, recordingSeconds),
        },
      })

      if (!result.allowed) {
        setError(result.message || 'Nao foi possivel usar IA para transcrever agora.')
        return
      }

      const transcript = result.transcript?.trim()
      if (transcript) {
        setText((current) => current.trim() ? `${current.trim()}\n\n${transcript}` : transcript)
        setTags((current) => current.includes('Transcricao de audio') ? current : ['Transcricao de audio', ...current])
      }
      setUsageMessage(formatAiUsageMessage(result))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel transcrever o audio.')
    } finally {
      setTranscribing(false)
    }
  }

  async function save() {
    if (!canSave || !selectedModel) {
      setError('Preencha a anotacao e siga as escolhas indicadas.')
      return
    }

    setSaving(true)
    setError('')
    const resolved = resolveAnnotation(workKind, selectedModel)
    const targetClassId = selectedModel.scope === 'teacher' ? undefined : classId || undefined
    const targetStudentId = selectedModel.scope === 'child' ? selectedStudent?.id : undefined
    const targetStudentName = selectedModel.scope === 'child' ? selectedStudent?.name ?? null : null
    const annotationInput = {
      category: resolved.category,
      label: resolved.label,
      text: text.trim(),
      classId: targetClassId,
      studentId: targetStudentId,
      studentName: targetStudentName,
      tags,
      persistence: resolved.persistence,
      attachmentName: attachmentName || null,
    }
    const localAnnotation = {
      id: `ann-${Date.now()}`,
      category: resolved.category,
      label: resolved.label,
      badgeClass: 'badge-ev',
      studentName: targetStudentName,
      text: text.trim(),
      date: 'Agora',
      classId: targetClassId,
      studentId: targetStudentId,
      tags: [selectedModel.label, ...tags],
      persistence: resolved.persistence,
      attachmentName: attachmentName || null,
      scope: selectedModel.scope === 'teacher' ? 'personal' as const : undefined,
    }

    try {
      if (getAppDataMode() === 'supabase' && isSupabaseConfigured()) {
        const savedAnnotation = await createSupabaseAnnotation(annotationInput)
        addAnnotation({ ...savedAnnotation, studentName: targetStudentName ?? savedAnnotation.studentName })
      } else {
        addAnnotation(localAnnotation)
      }

      closeSubscreen()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel salvar a anotacao agora.')
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
        <span className="font-serif text-[18px] text-gd flex-1">Nova anotacao</span>
        <button
          onClick={save}
          disabled={saving || !canSave}
          className="bg-gm text-white border-none rounded-full px-[16px] py-[7px] text-[13px] font-bold cursor-pointer flex items-center gap-1 disabled:opacity-50"
        >
          {saving ? '...' : <><Check size={13} /> Salvar</>}
        </button>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <section className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Anotacao da professora</label>
          <textarea
            className="w-full min-h-[168px] px-0 py-3 border-0 bg-white font-sans text-sm text-ink outline-none resize-none leading-[1.7]"
            placeholder="Escreva o que observou, uma ideia de atividade, um ponto para relatorio ou algo importante da rotina."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-[10px] text-muted text-right">{text.length}</p>

          <div className="mt-3 rounded-app-sm border border-border bg-cream p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-[12px] font-bold text-ink">Audio para transcricao</p>
                <p className="text-[11px] text-muted">Grave ate 30 segundos. A transcricao consome GizTokens.</p>
              </div>
              <span className="text-[12px] font-bold text-gd">{recordingSeconds}s</span>
            </div>

            <div className="h-3 rounded-full bg-white border border-border overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, (recordingSeconds / MAX_AUDIO_SECONDS) * 100)}%`,
                  background: getRecordingBarColor(recordingSeconds),
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`rounded-app-sm py-3 text-[12px] font-bold flex items-center justify-center gap-2 ${
                  recording ? 'bg-[#C1440E] text-white' : 'bg-gm text-white'
                } disabled:opacity-50`}
              >
                {recording ? <Square size={14} /> : <Mic size={14} />}
                {recording ? 'Parar' : 'Gravar audio'}
              </button>
              <button
                type="button"
                onClick={transcribeAudio}
                disabled={!audioBlob || recording || transcribing}
                className="rounded-app-sm py-3 border border-gp bg-white text-gm text-[12px] font-bold disabled:opacity-50"
              >
                {transcribing ? 'Transcrevendo...' : 'Transcrever'}
              </button>
            </div>

            {audioBlob && !recording && (
              <p className="text-[11px] text-muted mt-2">Audio pronto para transcricao ({recordingSeconds}s).</p>
            )}
            {usageMessage && (
              <p className="text-[11px] text-gd mt-2 leading-[1.4]">{usageMessage}</p>
            )}
          </div>
        </section>

        <StepTitle number="1" title="O que esta anotacao vai ajudar a fazer?" />
        <div className="grid grid-cols-1 gap-2 mb-4">
          <ChoiceButton selected={workKind === 'report'} title="Relatorio ou documento" desc="Desenvolvimento, portfolio, diario de bordo, especialista, reuniao." onClick={() => chooseWorkKind('report')} />
          <ChoiceButton selected={workKind === 'planning'} title="Planejamento" desc="Anual, mensal, semanal, plano de aula ou projeto pedagogico." onClick={() => chooseWorkKind('planning')} />
          <ChoiceButton selected={workKind === 'memory'} title="Memoria pedagogica" desc="Registro rapido de evolucao, observacao importante ou ideia solta." onClick={() => chooseWorkKind('memory')} />
          <ChoiceButton selected={workKind === 'personal'} title="Anotacao pessoal" desc="Ideias e lembretes privados da professora, sem crianca vinculada." onClick={() => chooseWorkKind('personal')} />
        </div>

        {workKind && (
          <>
            <StepTitle number="2" title="Escolha o tipo correto" />
            <select
              className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors mb-3"
              value={modelId}
              onChange={(event) => chooseModel(event.target.value)}
            >
              <option value="">Selecionar tipo</option>
              {modelOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {selectedModel && (
              <p className="text-[11px] text-muted leading-[1.5] mb-4">{selectedModel.desc}</p>
            )}
          </>
        )}

        {selectedModel && needsClass && (
          <>
            <StepTitle number="3" title={needsStudent ? 'Escolha a crianca' : 'Escolha a turma'} />
            <select
              className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors mb-3"
              value={classId}
              onChange={(event) => updateClass(event.target.value)}
            >
              <option value="">Escolher turma</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            {needsStudent && (
              <select
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors mb-4"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                <option value="">Escolher crianca</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.name}</option>
                ))}
              </select>
            )}
          </>
        )}

        {selectedModel && (
          <>
            <StepTitle number={needsClass ? '4' : '3'} title="Detalhes opcionais" />
            <select
              className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors mb-3"
              value={tagToAdd}
              onChange={(event) => addTag(event.target.value)}
            >
              <option value="">Adicionar marcador</option>
              {TAGS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                    className="px-3 py-[7px] rounded-full border border-gp bg-gbg text-[11px] font-bold text-gm"
                  >
                    {tag} x
                  </button>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(event) => selectFile(event.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-[13px] rounded-app-sm border-[1.5px] border-gp bg-white text-gm font-bold text-[13px] flex items-center justify-center gap-2"
            >
              <Paperclip size={15} />
              Anexar imagem ou arquivo
            </button>
            {attachmentName && <p className="text-[11px] text-muted mt-2 leading-[1.5]">Anexo preparado: {attachmentName}</p>}
          </>
        )}

        {error && <p className="text-[12px] text-[#C1440E] mt-4 leading-[1.5]">{error}</p>}
      </div>
    </div>
  )
}

function getRecordingBarColor(seconds: number) {
  if (seconds <= 10) return '#4F8341'
  if (seconds <= 20) return interpolateColor('#4F8341', '#E0A800', (seconds - 10) / 10)
  return interpolateColor('#E0A800', '#C1440E', (seconds - 20) / 10)
}

function interpolateColor(from: string, to: string, ratio: number) {
  const start = hexToRgb(from)
  const end = hexToRgb(to)
  const clamped = Math.max(0, Math.min(1, ratio))
  const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * clamped))
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function getModelOptions(workKind: WorkKind) {
  if (workKind === 'report') return REPORT_MODELS
  if (workKind === 'planning') return PLANNING_MODELS
  if (workKind === 'memory') return MEMORY_MODELS
  if (workKind === 'personal') return PERSONAL_MODELS
  return []
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.07em] uppercase text-muted mt-[16px] mb-[8px]">
      <span className="inline-flex w-5 h-5 rounded-full bg-gbg text-gm items-center justify-center mr-2">{number}</span>
      {title}
    </p>
  )
}

function ChoiceButton({ selected, title, desc, onClick }: { selected: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-app-sm border text-left px-3 py-3"
      style={{
        borderColor: selected ? '#4F8341' : '#D4EBC8',
        background: selected ? '#F0FAF4' : '#fff',
      }}
    >
      <span className="block text-[13px] font-bold" style={{ color: selected ? '#4F8341' : '#1A1A1A' }}>{title}</span>
      <span className="block text-[11px] text-muted mt-[2px] leading-snug">{desc}</span>
    </button>
  )
}

function resolveAnnotation(workKind: WorkKind, model: ModelOption): {
  category: AnnotationCategory
  label: string
  persistence: AnnotationPersistence[]
} {
  if (workKind === 'planning') {
    return { category: model.id === 'projeto' ? 'projeto' : 'plano', label: model.label, persistence: ['planejamento-futuro'] }
  }

  if (workKind === 'memory') {
    return { category: 'evolucao', label: model.label, persistence: ['observacao-continua', 'observacao-importante'] }
  }

  if (workKind === 'personal') {
    return { category: 'formacao', label: model.label, persistence: ['observacao-importante'] }
  }

  if (model.id === 'portfolio') {
    return { category: 'portfolio', label: model.label, persistence: ['relatorio-atual', 'evolucao-positiva'] }
  }

  if (model.id === 'atipico' || model.id === 'especialista' || model.id === 'encaminhamento') {
    return { category: 'atipico', label: model.label, persistence: ['relatorio-atual', 'observacao-importante'] }
  }

  return { category: 'evolucao', label: model.label, persistence: ['relatorio-atual', 'observacao-continua'] }
}
