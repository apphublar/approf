import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Check, Mic, Paperclip, Send, Square } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import { formatAiUsageMessage, generateAiChatReply, transcribeAnnotationAudio } from '@/services/ai-usage'
import { createSupabaseAnnotation, updateSupabaseAnnotation } from '@/services/supabase/annotations'
import { isSupabaseConfigured } from '@/services/supabase/config'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import type { Annotation, AnnotationCategory, AnnotationPersistence } from '@/types'

type WorkKind = '' | 'report' | 'planning' | 'memory' | 'personal'
type Scope = 'child' | 'class' | 'optional-class' | 'teacher'
type AnnotationViewMode = 'annotation' | 'chat'

interface ModelOption {
  id: string
  label: string
  desc: string
  scope: Scope
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const REPORT_MODELS: ModelOption[] = [
  { id: 'desenvolvimento', label: 'Relatório de desenvolvimento', desc: 'Evolução individual da criança, sem comparações.', scope: 'child' },
  { id: 'atipico', label: 'Relatório atípico', desc: 'Observações pedagógicas, sem diagnóstico clínico.', scope: 'child' },
  { id: 'diario', label: 'Diário de bordo', desc: 'Rotina coletiva, atividades do dia e vivências da turma.', scope: 'class' },
  { id: 'portfolio', label: 'Portfólio pedagógico', desc: 'Evidências, produções, fotos e jornada individual.', scope: 'child' },
  { id: 'especialista', label: 'Relatório para especialista', desc: 'Neuropediatra, fono, TO, psicólogo ou psicopedagogo.', scope: 'child' },
  { id: 'encaminhamento', label: 'Encaminhamento pedagógico', desc: 'Registro para orientar família ou especialista.', scope: 'child' },
  { id: 'anamnese', label: 'Ficha de anamnese', desc: 'Informações iniciais e contexto da criança.', scope: 'child' },
  { id: 'reuniao-pais', label: 'Registro de reunião de pais', desc: 'Pontos tratados com a família.', scope: 'child' },
]

const PLANNING_MODELS: ModelOption[] = [
  { id: 'semanal', label: 'Planejamento semanal', desc: 'Rotina e propostas da semana.', scope: 'class' },
  { id: 'diario', label: 'Plano de aula diário', desc: 'Atividade, objetivo, materiais e desenvolvimento.', scope: 'class' },
  { id: 'projeto', label: 'Projeto pedagógico específico', desc: 'Projeto por tema, interesse da turma ou necessidade observada.', scope: 'class' },
]

const MEMORY_MODELS: ModelOption[] = [
  { id: 'evolucao', label: 'Evolução da criança', desc: 'Marco, progresso, fala, autonomia ou interação.', scope: 'child' },
  { id: 'observacao', label: 'Observação importante', desc: 'Algo que precisa acompanhar a rotina pedagógica.', scope: 'child' },
  { id: 'ideia', label: 'Ideia solta para depois', desc: 'Pensamento rápido para usar em relatório ou planejamento.', scope: 'optional-class' },
]

const PERSONAL_MODELS: ModelOption[] = [
  { id: 'pessoal', label: 'Anotação pessoal', desc: 'Registro privado da professora, sem vínculo com criança ou turma.', scope: 'teacher' },
  { id: 'lembrete', label: 'Lembrete de rotina', desc: 'Algo para lembrar depois sobre organização, materiais ou combinados.', scope: 'teacher' },
  { id: 'ideia-pessoal', label: 'Ideia para desenvolver', desc: 'Uma ideia livre para amadurecer antes de virar planejamento.', scope: 'teacher' },
]

const MAX_AUDIO_SECONDS = 30

export default function NewAnnotationSubscreen(props?: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const { addAnnotation, updateAnnotation, annotations, classes, activeClassId, activeStudentId, userId } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)

  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const activeStudent = activeClass?.students.find((item) => item.id === activeStudentId)

  const [text, setText] = useState('')
  const [workKind, setWorkKind] = useState<WorkKind>('')
  const [modelId, setModelId] = useState('')
  const [classId, setClassId] = useState(activeClass?.id ?? '')
  const [studentId, setStudentId] = useState(activeStudent?.id ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [attachmentName, setAttachmentName] = useState('')
  const [saving, setSaving] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [usageMessage, setUsageMessage] = useState('')
  const [audioMessage, setAudioMessage] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<AnnotationViewMode>('annotation')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatUsageMessage, setChatUsageMessage] = useState('')
  const [chatError, setChatError] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const chatBottomRef = useRef<HTMLDivElement | null>(null)
  const draftKeyRef = useRef('')

  const editAnnotation = useMemo(() => {
    const data = props?.data
    if (!data || typeof data !== 'object') return null
    const annotationId = (data as { annotationId?: unknown }).annotationId
    if (typeof annotationId !== 'string') return null
    return annotations.find((item) => item.id === annotationId) ?? null
  }, [annotations, props?.data])
  const editConfig = useMemo(() => (editAnnotation ? inferAnnotationEditorConfig(editAnnotation) : null), [editAnnotation])
  const isEditing = Boolean(editAnnotation)
  const prefillData = useMemo(() => {
    const data = props?.data
    if (!data || typeof data !== 'object') return null
    const prefill = (data as { prefill?: unknown }).prefill
    if (!prefill || typeof prefill !== 'object') return null
    const input = prefill as Record<string, unknown>
    return {
      workKind: isWorkKind(input.workKind) ? input.workKind : null,
      modelId: typeof input.modelId === 'string' ? input.modelId : null,
      classId: typeof input.classId === 'string' ? input.classId : null,
      studentId: typeof input.studentId === 'string' ? input.studentId : null,
      text: typeof input.text === 'string' ? input.text : null,
      directStudentNote: Boolean(input.directStudentNote),
    }
  }, [props?.data])
  const isDirectStudentNote = Boolean(prefillData?.directStudentNote) && !isEditing

  const modelOptions = getModelOptions(workKind)
  const selectedModel = modelOptions.find((item) => item.id === modelId)
  const selectedClass = classes.find((item) => item.id === classId) ?? activeClass
  const selectedStudent = selectedClass?.students.find((item) => item.id === studentId)
  const availableStudents = useMemo(() => selectedClass?.students ?? [], [selectedClass])
  const needsClass = isDirectStudentNote || selectedModel?.scope === 'class' || selectedModel?.scope === 'child'
  const needsStudent = isDirectStudentNote || selectedModel?.scope === 'child'
  const canSave = isDirectStudentNote
    ? text.trim().length >= 5 && Boolean(classId) && Boolean(studentId)
    : (
        text.trim().length >= 5 &&
        Boolean(workKind && selectedModel) &&
        (!needsClass || Boolean(classId)) &&
        (!needsStudent || Boolean(studentId))
      )

  useEffect(() => {
    if (!recording) return

    const interval = window.setInterval(() => {
      const elapsed = Math.min(MAX_AUDIO_SECONDS, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, chatLoading])

  useEffect(() => {
    if (!draftMessage) return
    const timeout = window.setTimeout(() => setDraftMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [draftMessage])

  useEffect(() => {
    if (!editAnnotation || !editConfig) return
    setText(editAnnotation.text ?? '')
    setWorkKind(editConfig.workKind)
    setModelId(editConfig.modelId)
    setClassId(editConfig.classId)
    setStudentId(editConfig.studentId)
    setTags(editConfig.tags)
    setAttachmentName(editAnnotation.attachmentName ?? '')
    setError('')
    setAudioMessage('')
    setUsageMessage('')
  }, [editAnnotation, editConfig])

  useEffect(() => {
    if (isEditing || !prefillData) return

    if (prefillData.workKind) setWorkKind(prefillData.workKind)
    if (prefillData.modelId) setModelId(prefillData.modelId)
    if (prefillData.classId) setClassId(prefillData.classId)
    if (prefillData.studentId) setStudentId(prefillData.studentId)
    if (prefillData.text) setText(prefillData.text)
    if (prefillData.directStudentNote) {
      setWorkKind('memory')
      setModelId('observacao')
    }
  }, [isEditing, prefillData])

  useEffect(() => {
    if (isEditing) return
    if (prefillData) return
    const key = `approf:draft:new-annotation:${userId}`
    draftKeyRef.current = key
    const draft = loadDraft<{
      text: string
      workKind: WorkKind
      modelId: string
      classId: string
      studentId: string
      tags: string[]
      attachmentName: string
      viewMode: AnnotationViewMode
      chatInput: string
      chatMessages: ChatMessage[]
    }>(key)
    if (!draft) return
    setText(draft.text || '')
    setWorkKind(draft.workKind || '')
    setModelId(draft.modelId || '')
    setClassId(draft.classId || '')
    setStudentId(draft.studentId || '')
    setTags(draft.tags || [])
    setAttachmentName(draft.attachmentName || '')
    setViewMode(draft.viewMode || 'annotation')
    setChatInput(draft.chatInput || '')
    setChatMessages(draft.chatMessages || [])
    setDraftMessage('Rascunho recuperado')
  }, [isEditing, prefillData, userId])

  useEffect(() => {
    if (isEditing) return
    if (!draftKeyRef.current) return
    const timeout = window.setTimeout(() => {
      saveDraft(draftKeyRef.current, {
        text,
        workKind,
        modelId,
        classId,
        studentId,
        tags,
        attachmentName,
        viewMode,
        chatInput,
        chatMessages,
      })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [
    attachmentName,
    chatInput,
    chatMessages,
    classId,
    isEditing,
    modelId,
    studentId,
    tags,
    text,
    viewMode,
    workKind,
  ])

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

  function selectFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setAttachmentName(file.name)
  }

  async function startRecording() {
    setError('')
    setUsageMessage('')
    setAudioMessage('')
    setAudioBlob(null)
    setRecordedSeconds(0)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAudioMessage('Este navegador não permite gravar áudio aqui.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, getSupportedAudioRecorderOptions())
      audioChunksRef.current = []
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const finalSeconds = Math.min(MAX_AUDIO_SECONDS, Math.max(1, Math.ceil((Date.now() - recordingStartedAtRef.current) / 1000)))
        setRecordedSeconds(finalSeconds)
        setRecordingSeconds(finalSeconds)
        if (blob.size === 0) {
          setAudioMessage('Não foi possível capturar o áudio. Grave novamente.')
          stopMediaStream()
          return
        }
        setAudioBlob(blob)
        setAudioMessage('Áudio pronto. Clique em Transcrever.')
        stopMediaStream()
      }

      setRecordingSeconds(0)
      setRecording(true)
      recorder.start()
    } catch {
      setAudioMessage('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
      stopMediaStream()
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setRecording(false)
    setAudioMessage('Preparando áudio...')
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
  }

  async function transcribeAudio() {
    if (!audioBlob) {
      setAudioMessage('Grave e pare o áudio antes de transcrever.')
      return
    }

    setTranscribing(true)
    setError('')
    setUsageMessage('')
    setAudioMessage('Enviando áudio para transcrição...')

    try {
      const durationSeconds = recordedSeconds || Math.max(1, recordingSeconds)
      const result = await transcribeAnnotationAudio({
        audio: audioBlob,
        durationSeconds,
        classId: classId || null,
        studentId: studentId || null,
        requestSummary: {
          source: 'new_annotation',
          workKind,
          modelId,
          durationSeconds,
        },
      })

      if (!result.allowed) {
        setError(result.message || 'Não foi possível transcrever agora.')
        return
      }

      const transcript = result.transcript?.trim()
      if (transcript) {
        setText((current) => current.trim() ? `${current.trim()}\n\n${transcript}` : transcript)
        setTags((current) => current.includes('Transcrição de áudio') ? current : ['Transcrição de áudio', ...current])
      }
      setAudioMessage('Transcrição adicionada na anotação.')
      setUsageMessage(formatAiUsageMessage(result))
    } catch (error) {
      setAudioMessage(error instanceof Error ? error.message : 'Não foi possível transcrever o áudio.')
    } finally {
      setTranscribing(false)
    }
  }

  async function save() {
    if (!canSave || (!selectedModel && !isDirectStudentNote)) {
      setError('Preencha a anotação e siga as escolhas indicadas.')
      return
    }

    setSaving(true)
    setError('')
    const effectiveModel = selectedModel ?? MEMORY_MODELS[1]
    const resolved = isDirectStudentNote
      ? {
          category: 'evolucao' as AnnotationCategory,
          label: 'Anotação direta',
          persistence: ['observacao-continua', 'observacao-importante'] as AnnotationPersistence[],
        }
      : resolveAnnotation(workKind, effectiveModel)
    const targetClassId = effectiveModel.scope === 'teacher' ? undefined : classId || undefined
    const targetStudentId = (isDirectStudentNote || effectiveModel.scope === 'child') ? selectedStudent?.id : undefined
    const targetStudentName = (isDirectStudentNote || effectiveModel.scope === 'child') ? selectedStudent?.name ?? null : null
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
      tags: [isDirectStudentNote ? 'Anotação direta' : effectiveModel.label, ...tags],
      persistence: resolved.persistence,
      attachmentName: attachmentName || null,
      scope: !isDirectStudentNote && effectiveModel.scope === 'teacher' ? 'personal' as const : undefined,
    }

    try {
      if (getAppDataMode() === 'supabase' && isSupabaseConfigured()) {
        if (editAnnotation) {
          const savedAnnotation = await updateSupabaseAnnotation({
            annotationId: editAnnotation.id,
            ...annotationInput,
          })
          updateAnnotation({ ...savedAnnotation, studentName: targetStudentName ?? savedAnnotation.studentName })
        } else {
          const savedAnnotation = await createSupabaseAnnotation(annotationInput)
          addAnnotation({ ...savedAnnotation, studentName: targetStudentName ?? savedAnnotation.studentName })
        }
      } else {
        if (editAnnotation) {
          updateAnnotation({
            ...localAnnotation,
            id: editAnnotation.id,
            date: 'Agora',
          })
        } else {
          addAnnotation(localAnnotation)
        }
      }

      if (!isEditing && draftKeyRef.current) {
        clearDraft(draftKeyRef.current)
      }
      closeSubscreen()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar a anotação agora.')
    } finally {
      setSaving(false)
    }
  }

  async function sendChatMessage() {
    const content = chatInput.trim()
    if (!content || chatLoading) return
    setChatError('')
    setChatUsageMessage('')
    setChatInput('')
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: content,
    }
    const history = [...chatMessages, userMessage]
    setChatMessages(history)
    setChatLoading(true)

    try {
      const result = await generateAiChatReply({
        provider: 'openai',
        messages: history.map((message) => ({ role: message.role, content: message.text })),
        classId: classId || null,
        studentId: studentId || null,
        requestSummary: {
          source: 'new-annotation-chat',
          provider: 'openai',
          model: 'gpt-4o-mini',
          conversationLength: history.length,
        },
      })

      if (!result.allowed) {
        setChatError(result.message || 'Não foi possível continuar o chat agora.')
        return
      }

      const assistantText = result.response?.trim()
      if (!assistantText) {
        setChatError('Não foi possível obter uma resposta válida.')
        return
      }

      setChatMessages([...history, { id: `assistant-${Date.now()}`, role: 'assistant', text: assistantText }])
      setChatUsageMessage(formatAiUsageMessage(result))
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Não foi possível responder no chat agora.')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">{isDirectStudentNote ? 'Anotação do aluno' : (isEditing ? 'Editar anotação' : 'Nova anotação')}</span>
          {!isEditing && (
            <div className="mt-2 inline-flex rounded-full border border-border bg-cream p-1">
              <button
                onClick={() => setViewMode('annotation')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${viewMode === 'annotation' ? 'bg-white text-gd shadow-sm' : 'text-muted'}`}
              >
                Anotação
              </button>
              <button
                onClick={() => setViewMode('chat')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${viewMode === 'chat' ? 'bg-white text-gd shadow-sm' : 'text-muted'}`}
              >
                Chat
              </button>
            </div>
          )}
        </div>
        {viewMode === 'annotation' && (
          <button
            onClick={save}
            disabled={saving || !canSave}
            className="bg-gm text-white border-none rounded-full px-[16px] py-[7px] text-[13px] font-bold cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? '...' : <><Check size={13} /> {isEditing ? 'Atualizar' : 'Salvar'}</>}
          </button>
        )}
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        {viewMode === 'annotation' ? (
          <>
        <section className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Anotação da professora</label>
          <textarea
            className="w-full min-h-[168px] px-0 py-3 border-0 bg-white font-sans text-sm text-ink outline-none resize-none leading-[1.7]"
            placeholder="Escreva o que observou, uma ideia de atividade, um ponto para relatório ou algo importante da rotina."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-[10px] text-muted text-right">{text.length}</p>

          <div className="mt-3 rounded-app-sm border border-border bg-cream p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-[12px] font-bold text-ink">Áudio para transcrição</p>
                <p className="text-[11px] text-muted">Grave até 30 segundos. A transcrição consome GizTokens.</p>
              </div>
              <span className="text-[12px] font-bold text-gd">{recording ? recordingSeconds : recordedSeconds || recordingSeconds}s</span>
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
                disabled={recording || transcribing}
                className="rounded-app-sm py-3 border border-gp bg-white text-gm text-[12px] font-bold disabled:opacity-50"
              >
                {transcribing ? 'Transcrevendo...' : 'Transcrever'}
              </button>
            </div>

            {audioBlob && !recording && (
              <p className="text-[11px] text-muted mt-2">Áudio pronto para transcrição ({recordedSeconds || recordingSeconds}s).</p>
            )}
            {audioMessage && (
              <p className="text-[11px] text-muted mt-2 leading-[1.4]">{audioMessage}</p>
            )}
            {usageMessage && (
              <p className="text-[11px] text-gd mt-2 leading-[1.4]">{usageMessage}</p>
            )}
          </div>
        </section>

        {!isDirectStudentNote && (
          <>
            <StepTitle number="1" title="O que esta anotação vai ajudar a fazer?" />
            <div className="grid grid-cols-1 gap-2 mb-4">
              <ChoiceButton selected={workKind === 'report'} title="Relatório ou documento" desc="Desenvolvimento, portfólio, diário de bordo, especialista, reunião." onClick={() => chooseWorkKind('report')} />
              <ChoiceButton selected={workKind === 'planning'} title="Planejamento" desc="Semanal, diário ou projeto pedagógico." onClick={() => chooseWorkKind('planning')} />
              <ChoiceButton selected={workKind === 'memory'} title="Memoria pedagógica" desc="Registro rapido de evolucao, observacao importante ou ideia solta." onClick={() => chooseWorkKind('memory')} />
              <ChoiceButton selected={workKind === 'personal'} title="Anotação pessoal" desc="Ideias e lembretes privados da professora, sem criança vinculada." onClick={() => chooseWorkKind('personal')} />
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
          </>
        )}

        {!isDirectStudentNote && (selectedModel || isDirectStudentNote) && needsClass && (
          <>
            <StepTitle number={isDirectStudentNote ? '1' : '3'} title={needsStudent || isDirectStudentNote ? 'Escolha a criança' : 'Escolha a turma'} />
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
            {(needsStudent || isDirectStudentNote) && (
              <select
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors mb-4"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                <option value="">Escolher criança</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.name}</option>
                ))}
              </select>
            )}
          </>
        )}

        {selectedModel && !isDirectStudentNote && (
          <>
            <StepTitle number={needsClass ? '4' : '3'} title="Detalhes opcionais" />
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
          </>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="bg-white rounded-app border border-border shadow-card p-3">
              <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Chat</p>
            </div>

            <div className="bg-white rounded-app border border-border shadow-card p-3 flex-1 min-h-[420px] flex flex-col">
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-muted leading-relaxed">
                    Inicie uma conversa. O chat é livre e responde em texto.
                  </p>
                )}
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'ml-auto bg-gm text-white'
                        : 'mr-auto bg-cream text-ink border border-border'
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="mr-auto bg-cream text-muted border border-border rounded-2xl px-3 py-2 text-sm">
                    Pensando...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              <div className="pt-3 mt-3 border-t border-border">
                <div className="flex items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendChatMessage()
                      }
                    }}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 min-h-[46px] max-h-[120px] rounded-app-sm border border-border px-3 py-2 text-sm outline-none resize-none focus:border-gl"
                  />
                  <button
                    onClick={() => void sendChatMessage()}
                    disabled={chatLoading || chatInput.trim().length === 0}
                    className="h-[46px] w-[46px] rounded-full bg-gm text-white flex items-center justify-center disabled:opacity-50"
                    aria-label="Enviar mensagem"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {chatUsageMessage && <p className="text-[11px] text-gd mt-2">{chatUsageMessage}</p>}
                {chatError && <p className="text-[11px] text-[#C1440E] mt-2">{chatError}</p>}
                {draftMessage && <p className="text-[11px] text-gm mt-2">{draftMessage}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getRecordingBarColor(seconds: number) {
  if (seconds <= 10) return '#4F8341'
  if (seconds <= 20) return interpolateColor('#4F8341', '#E0A800', (seconds - 10) / 10)
  return interpolateColor('#E0A800', '#C1440E', (seconds - 20) / 10)
}

function getSupportedAudioRecorderOptions(): MediaRecorderOptions | undefined {
  const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
  return mimeType ? { mimeType } : undefined
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

function isWorkKind(value: unknown): value is WorkKind {
  return value === 'report' || value === 'planning' || value === 'memory' || value === 'personal' || value === ''
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

function inferAnnotationEditorConfig(annotation: Annotation) {
  const modelMatch = findModelByLabel(annotation.label)
  const workKind = modelMatch?.workKind ?? inferWorkKindFromAnnotation(annotation)

  return {
    workKind,
    modelId: modelMatch?.model.id ?? '',
    classId: annotation.classId ?? '',
    studentId: annotation.studentId ?? '',
    tags: (annotation.tags ?? []).filter((tag) => tag !== annotation.label),
  }
}

function findModelByLabel(label: string) {
  const normalized = normalizeText(label)
  const groups: Array<{ workKind: WorkKind; models: ModelOption[] }> = [
    { workKind: 'report', models: REPORT_MODELS },
    { workKind: 'planning', models: PLANNING_MODELS },
    { workKind: 'memory', models: MEMORY_MODELS },
    { workKind: 'personal', models: PERSONAL_MODELS },
  ]

  for (const group of groups) {
    const model = group.models.find((item) => normalizeText(item.label) === normalized)
    if (model) return { workKind: group.workKind, model }
  }

  return null
}

function inferWorkKindFromAnnotation(annotation: Annotation): WorkKind {
  if (annotation.scope === 'personal') return 'personal'
  if (annotation.category === 'plano' || annotation.category === 'projeto') return 'planning'
  if (annotation.category === 'portfolio' || annotation.category === 'atipico') return 'report'
  return 'memory'
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}



