import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Check, Mic, Paperclip, Pencil, PlusCircle, Send, Square, Trash2 } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import { formatAiUsageMessage, generateAiChatReply, transcribeAnnotationAudio } from '@/services/ai-usage'
import { createSupabaseAnnotation, deleteSupabaseAnnotation, updateSupabaseAnnotation } from '@/services/supabase/annotations'
import { isSupabaseConfigured } from '@/services/supabase/config'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import type { Annotation, AnnotationCategory, AnnotationPersistence } from '@/types'

type WorkKind = '' | 'report' | 'planning' | 'personal'
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

interface ChatConversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

interface SavedCustomCategory {
  id: string
  title: string
  description: string
}

const REPORT_MODELS: ModelOption[] = [
  { id: 'turma', label: 'Registro da turma', desc: 'Anotação coletiva vinculada à turma.', scope: 'class' },
  { id: 'crianca', label: 'Registro de uma criança', desc: 'Anotação vinculada a uma criança.', scope: 'child' },
]

const PLANNING_MODELS: ModelOption[] = [
  { id: 'planejamento', label: 'Planejamento', desc: 'Anotação de planejamento (turma opcional).', scope: 'optional-class' },
]

const PERSONAL_MODELS: ModelOption[] = [
  { id: 'pessoal', label: 'Anotação pessoal', desc: 'Registro privado da professora, sem vínculo com criança ou turma.', scope: 'teacher' },
]

const MAX_AUDIO_SECONDS = 30
export default function NewAnnotationSubscreen(props?: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const { addAnnotation, updateAnnotation, removeAnnotation, annotations, classes, activeClassId, activeStudentId, userId } = useAppStore()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)

  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const activeStudent = activeClass?.students.find((item) => item.id === activeStudentId)

  const [text, setText] = useState('')
  const [workKind, setWorkKind] = useState<WorkKind>('report')
  const [modelId, setModelId] = useState('turma')
  const [classId, setClassId] = useState(activeClass?.id ?? '')
  const [studentId, setStudentId] = useState(activeStudent?.id ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [newCustomCategory, setNewCustomCategory] = useState('')
  const [savedCustomCategories, setSavedCustomCategories] = useState<SavedCustomCategory[]>([])
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('turma')
  const [categoryMessage, setCategoryMessage] = useState('')
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryTitle, setEditingCategoryTitle] = useState('')
  const detailsSectionRef = useRef<HTMLDivElement | null>(null)
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
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
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>(() => [buildNewConversation()])
  const [activeChatId, setActiveChatId] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatUsageMessage, setChatUsageMessage] = useState('')
  const [chatError, setChatError] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const chatBottomRef = useRef<HTMLDivElement | null>(null)
  const draftKeyRef = useRef('')
  const activeChat = useMemo(
    () => chatConversations.find((conversation) => conversation.id === activeChatId) ?? chatConversations[0] ?? null,
    [activeChatId, chatConversations],
  )
  const chatMessages = activeChat?.messages ?? []
  const activeChatViewKey = activeChat?.id ?? 'chat-empty'

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
  const stayAfterSave = useMemo(() => {
    const data = props?.data
    if (!data || typeof data !== 'object' || isEditing) return false
    return Boolean((data as { stayAfterSave?: boolean }).stayAfterSave)
  }, [props?.data, isEditing])

  const selectedModel = findModelById(modelId)
  const selectedClass = classes.find((item) => item.id === classId) ?? activeClass
  const selectedStudent = selectedClass?.students.find((item) => item.id === studentId)
  const availableStudents = useMemo(() => selectedClass?.students ?? [], [selectedClass])
  const hasMultipleClasses = classes.length > 1
  const isTurmaType = selectedCategoryKey === 'turma'
  const isChildType = selectedCategoryKey === 'crianca'
  const isPlanningType = selectedCategoryKey === 'planejamento'
  const isPersonalType = selectedCategoryKey === 'pessoal'
  const showClassPicker = (isDirectStudentNote || isTurmaType || isChildType) && hasMultipleClasses
  const showStudentPicker = isDirectStudentNote || isChildType
  const canSave = isDirectStudentNote
    ? text.trim().length >= 5 && Boolean(classId) && Boolean(studentId)
    : (
        text.trim().length >= 5 &&
        Boolean(workKind && selectedModel) &&
        (!isTurmaType && !isChildType || Boolean(classId)) &&
        (!isChildType || Boolean(studentId))
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
    if (!categoryMessage) return
    const timeout = window.setTimeout(() => setCategoryMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [categoryMessage])

  useEffect(() => {
    if (!userId) return
    setSavedCustomCategories(loadSavedCustomCategories(userId))
  }, [userId])

  useEffect(() => {
    if (chatConversations.length === 0) {
      const initial = buildNewConversation()
      setChatConversations([initial])
      setActiveChatId(initial.id)
      return
    }
    if (!activeChatId || !chatConversations.some((item) => item.id === activeChatId)) {
      setActiveChatId(chatConversations[0].id)
    }
  }, [activeChatId, chatConversations])

  useEffect(() => {
    if (!editAnnotation || !editConfig) return
    setText(editAnnotation.text ?? '')
    setWorkKind(editConfig.workKind)
    setModelId(editConfig.modelId)
    setClassId(editConfig.classId)
    setStudentId(editConfig.studentId)
    setTags(editConfig.tags)
    setCustomCategory(editConfig.customCategory)
    setSelectedCategoryKey(inferSelectedCategoryKey(editConfig.workKind, editConfig.modelId, editConfig.customCategory))
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
      setWorkKind('report')
      setModelId('crianca')
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
      customCategory: string
      newCustomCategory: string
      attachmentName: string
      viewMode: AnnotationViewMode
      chatInput: string
      chatMessages?: ChatMessage[]
      chatConversations?: ChatConversation[]
      activeChatId?: string
    }>(key)
    if (!draft) return
    setText(draft.text || '')
    setWorkKind(draft.workKind || 'report')
    setModelId(draft.modelId || 'turma')
    setClassId(draft.classId || '')
    setStudentId(draft.studentId || '')
    setTags(draft.tags || [])
    setCustomCategory(draft.customCategory || '')
    setNewCustomCategory(draft.newCustomCategory || '')
    setSelectedCategoryKey(inferSelectedCategoryKey(draft.workKind || 'report', draft.modelId || 'turma', draft.customCategory || ''))
    setAttachmentName(draft.attachmentName || '')
    setViewMode(draft.viewMode || 'annotation')
    setChatInput(draft.chatInput || '')
    const conversations = sanitizeConversations(draft.chatConversations, draft.chatMessages)
    setChatConversations(conversations)
    setActiveChatId(draft.activeChatId && conversations.some((item) => item.id === draft.activeChatId)
      ? draft.activeChatId
      : conversations[0]?.id ?? '')
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
        customCategory,
        newCustomCategory,
        attachmentName,
        viewMode,
        chatInput,
        chatConversations,
        activeChatId,
      })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [
    attachmentName,
    activeChatId,
    chatInput,
    chatConversations,
    classId,
    isEditing,
    modelId,
    studentId,
    tags,
    customCategory,
    newCustomCategory,
    text,
    viewMode,
    workKind,
  ])

  function choosePlanningTarget() {
    setSelectedCategoryKey('planejamento')
    setWorkKind('planning')
    setModelId('planejamento')
    setCustomCategory('')
    setClassId('')
    setStudentId('')
    setError('')
  }

  function choosePersonalTarget() {
    setSelectedCategoryKey('pessoal')
    setWorkKind('personal')
    setModelId('pessoal')
    setCustomCategory('')
    setClassId('')
    setStudentId('')
    setError('')
  }

  function chooseDefaultTarget(target: 'class' | 'child') {
    const fallbackClass = activeClass ?? classes[0]
    setWorkKind('report')
    setCustomCategory('')
    setError('')
    setClassId(fallbackClass?.id ?? '')
    if (target === 'class') {
      setSelectedCategoryKey('turma')
      setModelId('turma')
      setStudentId('')
      return
    }
    setSelectedCategoryKey('crianca')
    setModelId('crianca')
    setStudentId(activeStudent?.id ?? fallbackClass?.students[0]?.id ?? '')
  }

  function applySavedCustomCategory(category: SavedCustomCategory) {
    const normalizedKey = normalizeText(category.title)
    const isPlanningCategory = normalizedKey.includes('planej') || normalizedKey.includes('projeto')
    if (isPlanningCategory) {
      setWorkKind('planning')
      setModelId('planejamento')
      setClassId('')
      setStudentId('')
    } else {
      setWorkKind('personal')
      setModelId('pessoal')
      setClassId('')
      setStudentId('')
    }
    setCustomCategory(category.title)
    setSelectedCategoryKey(`custom:${category.id}`)
    setError('')
  }

  function selectSavedCustomCategory(category: SavedCustomCategory) {
    applySavedCustomCategory(category)
    setCategoryMessage(`Categoria "${category.title}" selecionada.`)
  }

  function countAnnotationsForCategory(category: SavedCustomCategory) {
    return annotations.filter((annotation) =>
      annotation.label === category.title || (annotation.tags ?? []).includes(category.title),
    ).length
  }

  function renameCustomCategory(category: SavedCustomCategory, nextTitle: string) {
    const normalized = nextTitle.trim()
    if (!normalized || normalized === category.title) return

    const nextCategory: SavedCustomCategory = {
      id: slugifyCategory(normalized),
      title: normalized,
      description: buildCustomCategoryDescription(normalized),
    }

    setSavedCustomCategories((current) => {
      const withoutOld = current.filter((item) => item.id !== category.id && item.id !== nextCategory.id)
      const next = [...withoutOld, nextCategory]
      if (userId) persistSavedCustomCategories(userId, next)
      return next
    })

    const affected = annotations.filter((annotation) =>
      annotation.label === category.title || (annotation.tags ?? []).includes(category.title),
    )

    for (const annotation of affected) {
      const nextTags = (annotation.tags ?? []).map((tag) => (tag === category.title ? normalized : tag))
      const nextAnnotation = {
        ...annotation,
        label: annotation.label === category.title ? normalized : annotation.label,
        tags: nextTags,
      }
      updateAnnotation(nextAnnotation)
      if (getAppDataMode() === 'supabase' && isSupabaseConfigured()) {
        void updateSupabaseAnnotation({
          annotationId: annotation.id,
          category: annotation.category,
          label: nextAnnotation.label,
          text: annotation.text,
          classId: annotation.classId,
          studentId: annotation.studentId,
          studentName: annotation.studentName,
          tags: nextTags,
          persistence: annotation.persistence ?? [],
          attachmentName: annotation.attachmentName ?? null,
        }).catch(() => undefined)
      }
    }

    if (selectedCategoryKey === `custom:${category.id}` || customCategory === category.title) {
      applySavedCustomCategory(nextCategory)
    }
    setEditingCategoryId(null)
    setEditingCategoryTitle('')
    setCategoryMessage(`Categoria renomeada para "${normalized}".`)
  }

  async function deleteCustomCategory(category: SavedCustomCategory) {
    const affectedCount = countAnnotationsForCategory(category)
    const confirmed = window.confirm(
      affectedCount > 0
        ? `Esta categoria possui ${affectedCount} anotação(ões). Se você excluir, todas serão apagadas permanentemente e não poderão ser recuperadas. Deseja continuar?`
        : `Excluir a categoria "${category.title}"?`,
    )
    if (!confirmed) return

    const affected = annotations.filter((annotation) =>
      annotation.label === category.title || (annotation.tags ?? []).includes(category.title),
    )

    for (const annotation of affected) {
      removeAnnotation(annotation.id)
      if (getAppDataMode() === 'supabase' && isSupabaseConfigured()) {
        try {
          await deleteSupabaseAnnotation(annotation.id)
        } catch {
          // mantém remoção local mesmo se a API falhar
        }
      }
    }

    setSavedCustomCategories((current) => {
      const next = current.filter((item) => item.id !== category.id)
      if (userId) persistSavedCustomCategories(userId, next)
      return next
    })

    if (selectedCategoryKey === `custom:${category.id}` || customCategory === category.title) {
      chooseDefaultTarget('class')
    }
    setEditingCategoryId(null)
    setEditingCategoryTitle('')
    setCategoryMessage(
      affectedCount > 0
        ? `Categoria excluída com ${affectedCount} anotação(ões) removida(s).`
        : `Categoria "${category.title}" excluída.`,
    )
  }

  function resetAnnotationForm() {
    setText('')
    setTags([])
    setAttachmentName('')
    setAttachmentFile(null)
    setAudioBlob(null)
    setRecordedSeconds(0)
    setRecordingSeconds(0)
    setUsageMessage('')
    setAudioMessage('')
    setError('')
    if (draftKeyRef.current) clearDraft(draftKeyRef.current)
  }

  function createCustomCategory() {
    const normalized = newCustomCategory.trim()
    if (!normalized) {
      setError('Informe o nome da categoria.')
      return
    }

    const category: SavedCustomCategory = {
      id: slugifyCategory(normalized),
      title: normalized,
      description: buildCustomCategoryDescription(normalized),
    }

    setSavedCustomCategories((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== category.id)
      const next = [...withoutDuplicate, category]
      if (userId) persistSavedCustomCategories(userId, next)
      return next
    })

    applySavedCustomCategory(category)
    setNewCustomCategory('')
    setError('')
    setCategoryMessage(`Categoria "${normalized}" adicionada abaixo.`)
    window.setTimeout(() => {
      detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function updateClass(id: string) {
    const nextClass = classes.find((item) => item.id === id)
    setClassId(id)
    setStudentId(selectedModel?.scope === 'child' ? nextClass?.students[0]?.id ?? '' : '')
  }

  function selectFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Neste campo só é possível anexar imagem.')
      return
    }
    setError('')
    setAttachmentFile(file)
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
    const effectiveModel = selectedModel ?? REPORT_MODELS[1]
    const normalizedCustomCategory = customCategory.trim()
    const effectiveTags = normalizedCustomCategory && !tags.includes(normalizedCustomCategory)
      ? [normalizedCustomCategory, ...tags]
      : tags
    const resolved = isDirectStudentNote
      ? {
          category: 'evolucao' as AnnotationCategory,
          label: 'Anotação direta',
          persistence: ['observacao-continua', 'observacao-importante'] as AnnotationPersistence[],
        }
      : resolveAnnotation(workKind, effectiveModel, normalizedCustomCategory)
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
      tags: effectiveTags,
      persistence: resolved.persistence,
      attachmentName: attachmentName || null,
      attachmentFile,
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
      tags: [resolved.label, ...effectiveTags.filter((tag) => tag !== resolved.label)],
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

      if (stayAfterSave) {
        resetAnnotationForm()
        setSaveSuccessMessage('Anotação salva. Você pode registrar outra agora.')
      } else {
        if (!isEditing && draftKeyRef.current) {
          clearDraft(draftKeyRef.current)
        }
        closeSubscreen()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar a anotação agora.')
    } finally {
      setSaving(false)
    }
  }

  async function sendChatMessage() {
    const content = chatInput.trim()
    if (!content || chatLoading || !activeChat) return
    setChatError('')
    setChatUsageMessage('')
    setChatInput('')
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: content,
    }
    const history = [...activeChat.messages, userMessage]
    const targetConversationId = activeChat.id
    applyConversationUpdate(targetConversationId, history, content)
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
          model: 'gpt-5.5',
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

      applyConversationUpdate(targetConversationId, [...history, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
      }])
      setChatUsageMessage(formatAiUsageMessage(result))
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Não foi possível responder no chat agora.')
    } finally {
      setChatLoading(false)
    }
  }

  function applyConversationUpdate(conversationId: string, messages: ChatMessage[], userInputForTitle?: string) {
    setChatConversations((current) => {
      const next = current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation
        return {
          ...conversation,
          messages,
          updatedAt: Date.now(),
          title: conversation.title === 'Nova conversa' && userInputForTitle
            ? buildConversationTitle(userInputForTitle)
            : conversation.title,
        }
      })
      return sortConversationsByRecent(next)
    })
  }

  function startNewChat() {
    if (chatLoading) return
    const conversation = buildNewConversation()
    setChatConversations((current) => sortConversationsByRecent([conversation, ...current]))
    setActiveChatId(conversation.id)
    setChatInput('')
    setChatError('')
    setChatUsageMessage('')
  }

  function openChatConversation(conversationId: string) {
    if (conversationId === activeChatId) return
    setActiveChatId(conversationId)
    setChatError('')
    setChatUsageMessage('')
  }

  function deleteChatConversation(conversationId: string) {
    if (chatLoading) return
    const confirmed = window.confirm('Deseja excluir esta conversa do histórico?')
    if (!confirmed) return
    setChatConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== conversationId)
      if (next.length === 0) {
        const fallback = buildNewConversation()
        setActiveChatId(fallback.id)
        return [fallback]
      }
      if (conversationId === activeChatId) {
        setActiveChatId(next[0].id)
      }
      return next
    })
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
                {recording ? 'Parar' : 'Gravar áudio'}
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
            <StepTitle number="1" title="Tipo de anotação" />
            <div className="grid grid-cols-1 gap-2 mb-3">
              <ChoiceButton selected={isTurmaType} title="Turma" desc="Anotação geral da turma, sem escolher uma criança específica." onClick={() => chooseDefaultTarget('class')} />
              <ChoiceButton selected={isChildType} title="Criança" desc="Anotação vinculada a uma criança da turma." onClick={() => chooseDefaultTarget('child')} />
              <ChoiceButton
                selected={isPlanningType}
                title="Planejamento"
                desc="Alimenta planejamento diário/semanal, projeto pedagógico e reunião de pais."
                onClick={() => choosePlanningTarget()}
              />
              <ChoiceButton
                selected={isPersonalType}
                title="Anotação pessoal"
                desc="Registro privado da professora, sem vínculo com criança ou turma."
                onClick={() => choosePersonalTarget()}
              />
              {savedCustomCategories.map((category) => {
                const selected = selectedCategoryKey === `custom:${category.id}`
                return (
                  <div
                    key={category.id}
                    className="rounded-app-sm border px-3 py-3"
                    style={{
                      borderColor: selected ? '#4F8341' : '#D4EBC8',
                      background: selected ? '#F0FAF4' : '#fff',
                    }}
                  >
                    {editingCategoryId === category.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editingCategoryTitle}
                          onChange={(event) => setEditingCategoryTitle(event.target.value)}
                          className="min-w-0 flex-1 px-3 py-2 rounded-app-sm border border-border bg-cream text-[13px]"
                        />
                        <button
                          type="button"
                          onClick={() => renameCustomCategory(category, editingCategoryTitle)}
                          className="px-3 rounded-app-sm bg-gm text-white text-[11px] font-bold"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => selectSavedCustomCategory(category)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span
                            className="block text-[13px] font-bold"
                            style={{ color: selected ? '#4F8341' : '#1A1A1A' }}
                          >
                            {category.title}
                          </span>
                          <span className="block text-[11px] text-muted mt-[2px] leading-snug">
                            {category.description}
                          </span>
                        </button>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(category.id)
                              setEditingCategoryTitle(category.title)
                            }}
                            className="w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center text-muted"
                            aria-label={`Editar categoria ${category.title}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCustomCategory(category)}
                            className="w-9 h-9 rounded-full border border-[#F2C4B8] bg-[#FFF5F2] flex items-center justify-center text-[#C1440E]"
                            aria-label={`Excluir categoria ${category.title}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {(isTurmaType || isChildType) && showClassPicker && (
              <div className="mb-3">
                <p className="text-[11px] font-bold text-muted mb-2">Escolha a turma</p>
                <select
                  className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
                  value={classId}
                  onChange={(event) => updateClass(event.target.value)}
                >
                  <option value="">Escolher turma</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isChildType && showStudentPicker && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-muted mb-2">Escolha a criança</p>
                <select
                  className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  <option value="">Escolher criança</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>
            )}

            <StepTitle number="2" title="Nova categoria" />
            <div className="rounded-app-sm border border-border bg-white p-3 mb-4">
              <p className="text-[11px] text-muted leading-[1.5] mb-3">
                Crie uma categoria própria para organizar anotações, lembretes ou registros especiais.
              </p>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 px-3 py-3 rounded-app-sm border border-border bg-cream font-sans text-sm text-ink outline-none focus:border-gl"
                  placeholder="Ex: Diário de Bordo"
                  value={newCustomCategory}
                  onChange={(event) => setNewCustomCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      createCustomCategory()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={createCustomCategory}
                  className="px-3 rounded-app-sm bg-gm text-white text-[12px] font-bold flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  Criar
                </button>
              </div>
              {categoryMessage && (
                <p className="text-[11px] text-gm mt-2 leading-[1.4] font-bold">{categoryMessage}</p>
              )}
            </div>
          </>
        )}

        {isDirectStudentNote && (
          <>
            <StepTitle number="1" title="Vínculo da anotação" />
            {showClassPicker && (
              <div className="mb-3">
                <p className="text-[11px] font-bold text-muted mb-2">Escolha a turma</p>
                <select
                  className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
                  value={classId}
                  onChange={(event) => updateClass(event.target.value)}
                >
                  <option value="">Escolher turma</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}
            {showStudentPicker && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-muted mb-2">Escolha a criança</p>
                <select
                  className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  <option value="">Escolher criança</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {(selectedModel || isDirectStudentNote) && (
          <div ref={detailsSectionRef}>
            <>
            <StepTitle number={isDirectStudentNote ? '2' : '3'} title="Detalhes opcionais" />
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

            <label className="relative w-full py-[13px] rounded-app-sm border-[1.5px] border-gp bg-white text-gm font-bold text-[13px] flex items-center justify-center gap-2 overflow-hidden">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(event) => {
                  selectFile(event.currentTarget.files)
                  event.currentTarget.value = ''
                }}
              />
              <Paperclip size={15} />
              <span aria-hidden="true">Anexar imagem</span>
            </label>
            {attachmentName && <p className="text-[11px] text-muted mt-2 leading-[1.5]">Anexo preparado: {attachmentName}</p>}
            </>
          </div>
        )}

        {saveSuccessMessage && (
          <p className="text-[12px] text-gm mt-4 leading-[1.5] font-bold">{saveSuccessMessage}</p>
        )}
        {error && <p className="text-[12px] text-[#C1440E] mt-4 leading-[1.5]">{error}</p>}
          </>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="bg-white rounded-app border border-border shadow-card p-3 flex-1 min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border">
                <p className="text-[12px] font-bold text-ink">Conversa</p>
                <button
                  onClick={startNewChat}
                  disabled={chatLoading}
                  className="px-3 py-2 rounded-app-sm border border-gp bg-gbg text-gd text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <PlusCircle size={13} />
                  Novo chat
                </button>
              </div>
              <div key={activeChatViewKey} className="flex-1 overflow-y-auto pr-1 space-y-3 stage-fade-in">
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

            <div className="bg-white rounded-app border border-border shadow-card p-3">
              <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-2">Histórico de conversas</p>
              <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1">
                {chatConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`rounded-app-sm border px-3 py-2 flex items-center gap-2 ${
                      activeChat?.id === conversation.id ? 'bg-gbg border-gp' : 'bg-cream border-border'
                    }`}
                  >
                    <button
                      onClick={() => openChatConversation(conversation.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className={`text-[12px] font-bold truncaté ${activeChat?.id === conversation.id ? 'text-gd' : 'text-ink'}`}>
                        {conversation.title}
                      </p>
                      <p className="text-[10px] text-muted mt-1">
                        {conversation.messages.length} mensagens
                      </p>
                    </button>
                    <button
                      onClick={() => deleteChatConversation(conversation.id)}
                      className="w-7 h-7 rounded-full bg-white border border-border text-muted flex items-center justify-center"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
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

function buildNewConversation(): ChatConversation {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nova conversa',
    updatedAt: Date.now(),
    messages: [],
  }
}

function buildConversationTitle(input: string) {
  const clean = input.trim().replace(/\s+/g, ' ')
  if (!clean) return 'Nova conversa'
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean
}

function sortConversationsByRecent(conversations: ChatConversation[]) {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}

function sanitizeConversations(
  conversations?: ChatConversation[],
  fallbackMessages?: ChatMessage[],
) {
  const normalized = (conversations ?? [])
    .filter((conversation) => conversation && typeof conversation.id === 'string')
    .map((conversation) => ({
      id: conversation.id,
      title: typeof conversation.title === 'string' && conversation.title.trim()
        ? conversation.title
        : 'Nova conversa',
      updatedAt: typeof conversation.updatedAt === 'number' ? conversation.updatedAt : Date.now(),
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    }))

  if (normalized.length > 0) return sortConversationsByRecent(normalized)
  if (fallbackMessages && fallbackMessages.length > 0) {
    return [{
      id: `chat-${Date.now()}`,
      title: 'Conversa recuperada',
      updatedAt: Date.now(),
      messages: fallbackMessages,
    }]
  }
  return [buildNewConversation()]
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

function findModelById(modelId: string) {
  return [...REPORT_MODELS, ...PLANNING_MODELS, ...PERSONAL_MODELS].find((item) => item.id === modelId)
}

function loadSavedCustomCategories(userId: string): SavedCustomCategory[] {
  try {
    const raw = window.localStorage.getItem(`approf:annotation-categories:${userId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => normalizeSavedCategory(value))
      .filter((value): value is SavedCustomCategory => Boolean(value))
  } catch {
    return []
  }
}

function persistSavedCustomCategories(userId: string, categories: SavedCustomCategory[]) {
  try {
    window.localStorage.setItem(`approf:annotation-categories:${userId}`, JSON.stringify(categories))
  } catch {
    // localStorage pode estar indisponível em navegação privada.
  }
}

function normalizeSavedCategory(value: unknown): SavedCustomCategory | null {
  if (typeof value === 'string' && value.trim()) {
    const title = value.trim()
    return {
      id: slugifyCategory(title),
      title,
      description: buildCustomCategoryDescription(title),
    }
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (!title) return null
  const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : slugifyCategory(title)
  const description = typeof record.description === 'string' && record.description.trim()
    ? record.description.trim()
    : buildCustomCategoryDescription(title)
  return { id, title, description }
}

function inferSelectedCategoryKey(workKind: WorkKind, modelId: string, customCategoryValue: string) {
  if (customCategoryValue.trim()) {
    return `custom:${slugifyCategory(customCategoryValue)}`
  }
  if (workKind === 'planning' || modelId === 'planejamento') return 'planejamento'
  if (workKind === 'personal' || modelId === 'pessoal') return 'pessoal'
  if (modelId === 'crianca') return 'crianca'
  return 'turma'
}

function slugifyCategory(title: string) {
  const slug = normalizeText(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || `categoria-${Date.now()}`
}

function buildCustomCategoryDescription(title: string) {
  const key = normalizeText(title)
  if (key.includes('diario') || key.includes('bordo')) {
    return 'Registro diário da rotina e observações da prática pedagógica.'
  }
  if (key.includes('lembrete') || key.includes('pendencia')) {
    return 'Lembretes e pendências importantes para acompanhar depois.'
  }
  if (key.includes('reuniao') || key.includes('pais')) {
    return 'Anotações para preparar conversas e registros de reunião com famílias.'
  }
  if (key.includes('planej') || key.includes('projeto')) {
    return 'Organização de ideias e registros para planejamento pedagógico.'
  }
  if (key.includes('formacao') || key.includes('curso')) {
    return 'Registros da sua formação continuada e desenvolvimento profissional.'
  }
  return `Anotações organizadas em "${title}" para consulta rápida na sua rotina.`
}

function isWorkKind(value: unknown): value is WorkKind {
  return value === 'report' || value === 'planning' || value === 'personal' || value === ''
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
      type="button"
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

function resolveAnnotation(workKind: WorkKind, model: ModelOption, customCategory?: string): {
  category: AnnotationCategory
  label: string
  persistence: AnnotationPersistence[]
} {
  if (workKind === 'planning') {
    return { category: 'plano', label: model.label, persistence: ['planejamento-futuro'] }
  }

  if (workKind === 'personal') {
    return { category: 'formacao', label: customCategory?.trim() || model.label, persistence: ['observacao-importante'] }
  }

  if (model.id === 'turma') {
    return { category: 'evolucao', label: 'Anotação da turma', persistence: ['relatorio-atual', 'observacao-continua'] }
  }

  return { category: 'portfolio', label: 'Anotação da criança', persistence: ['relatorio-atual', 'evolucao-positiva'] }
}

function inferAnnotationEditorConfig(annotation: Annotation) {
  const modelMatch = findModelByLabel(annotation.label)
  const workKind = modelMatch?.workKind ?? inferWorkKindFromAnnotation(annotation)
  const fallbackModelId = inferModelIdFromAnnotation(annotation, workKind)
  const customCategory = workKind === 'personal'
    ? getCustomCategoryFromAnnotation(annotation)
    : ''

  return {
    workKind,
    modelId: modelMatch?.model.id ?? fallbackModelId,
    classId: annotation.classId ?? '',
    studentId: annotation.studentId ?? '',
    tags: (annotation.tags ?? []).filter((tag) => tag !== annotation.label),
    customCategory,
  }
}

function inferModelIdFromAnnotation(annotation: Annotation, workKind: WorkKind) {
  if (workKind === 'personal') return 'pessoal'
  if (workKind === 'planning') return 'planejamento'
  if (workKind === 'report') return annotation.studentId ? 'crianca' : 'turma'
  return ''
}

function findModelByLabel(label: string) {
  const normalized = normalizeText(label)
  const groups: Array<{ workKind: WorkKind; models: ModelOption[] }> = [
    { workKind: 'report', models: REPORT_MODELS },
    { workKind: 'planning', models: PLANNING_MODELS },
    { workKind: 'personal', models: PERSONAL_MODELS },
  ]

  for (const group of groups) {
    const model = group.models.find((item) => normalizeText(item.label) === normalized)
    if (model) return { workKind: group.workKind, model }
  }

  return null
}

function getCustomCategoryFromAnnotation(annotation: Annotation) {
  const values = [annotation.label, ...(annotation.tags ?? [])]
  return values.find((value) => value.trim() && !isReservedAnnotationCategoryLabel(value))?.trim() ?? ''
}

function isReservedAnnotationCategoryLabel(value: string) {
  const normalized = normalizeText(value)
  return [
    'anotacao da turma',
    'anotacao da crianca',
    'anotacao direta',
    'registro da turma',
    'registro de uma crianca',
    'diario de bordo',
    'relatorio e portfolio',
    'planejamento',
    'anotacao pessoal',
    'transcricao de audio',
    'evolucao',
    'portfolio',
    'projeto',
    'formacao',
    'comunicado',
    'atipico',
  ].includes(normalized)
}

function inferWorkKindFromAnnotation(annotation: Annotation): WorkKind {
  if (annotation.scope === 'personal') return 'personal'
  if (annotation.category === 'plano' || annotation.category === 'projeto') return 'planning'
  if (annotation.category === 'portfolio' || annotation.category === 'atipico') return 'report'
  return 'report'
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
