import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ChevronLeft, FileText, FileUp, Image, KeyRound, Sparkles, X } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { formatAiUsageMessage, generateAiPortfolioImage, generateAiTextDocument, type AiGenerationType } from '@/services/ai-usage'
import { listReports, updateReport } from '@/services/reports'
import { uploadChildPortfolioMedia } from '@/services/supabase/child-media'
import { isSupabaseConfigured, isSupabaseAuthEnabled } from '@/services/supabase/config'
import { celebrateAiGeneration } from '@/utils/celebration'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import { loadDocumentStyleSettings } from '@/utils/document-style'
import { normalizeReportBodyHtml } from '@/utils/report-body'
import GenerationDocumentLoadingScreen from '@/components/ui/GenerationDocumentLoadingScreen'
import GenerationImageLoadingScreen from '@/components/ui/GenerationImageLoadingScreen'
import type { Annotation } from '@/types'

const AGE_GROUP_OPTIONS = [
  'Bebes (0 a 1 ano e 6 meses)',
  'Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)',
  'Crianças pequenas (4 anos a 5 anos e 11 meses)',
]

const BNCC_FIELD_OPTIONS = [
  'O eu, o outro e o nos',
  'Corpo, gestos e movimentos',
  'Tracos, sons, cores e formas',
  'Escuta, fala, pensamento e imaginacao',
  'Espacos, tempos, quantidades, relacoes e transformacoes',
]
interface ReportSubscreenProps {
  data?: unknown
}

interface ReportAttachment {
  id: string
  name: string
  size: number
  type: string
  isImage: boolean
  storagePath?: string
  dataUrl?: string
  extractedText?: string
}

type ReportMode = 'annotations' | 'blank'
type PortfólioOutput = 'text' | 'image'
type PortfolioImageFormat = 'portrait' | 'landscape' | 'square'
type ChildAnnotationMode = 'all' | 'one'

export default function ReportSubscreen({ data }: ReportSubscreenProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, activeStudentId, annotations, userId } = useAppStore()

  const allStudents = useMemo(
    () => classes.flatMap((classData) => classData.students.map((student) => ({ ...student, classId: classData.id, className: classData.name }))),
    [classes],
  )
  const defaultClassId = classes[0]?.id ?? ''
  const fallbackStudentId = activeStudentId ?? allStudents[0]?.id ?? ''
  const initialStudentId = typeof data === 'object' && data && 'studentId' in data && typeof (data as { studentId?: unknown }).studentId === 'string'
    ? String((data as { studentId: string }).studentId)
    : fallbackStudentId
  const initialClassId = typeof data === 'object' && data && 'classId' in data && typeof (data as { classId?: unknown }).classId === 'string'
    ? String((data as { classId: string }).classId)
    : defaultClassId
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const [selectedClassId, setSelectedClassId] = useState(initialClassId)
  const [historyScope, setHistoryScope] = useState<'model' | 'student'>('model')
  const [diaryDate, setDiaryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [diaryTheme, setDiaryTheme] = useState('')
  const [diaryRawText, setDiaryRawText] = useState('')
  const selectedStudent = allStudents.find((student) => student.id === selectedStudentId) ?? allStudents[0]
  const selectedClass = classes.find((cls) => cls.id === selectedClassId) ?? classes[0]

  const navData = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
  const initialDocumentTitle = typeof navData.documentTitle === 'string' ? navData.documentTitle : ''

  const reportKind = typeof navData.reportKind === 'string'
    ? navData.reportKind
    : 'Criador Pedagógico'
  const assistantMode = typeof navData.assistantMode === 'string' ? navData.assistantMode : ''
  const isUnifiedCreator = true
  const isPortfólio = false
  const isDevelopmentReport = false
  const isClassDiary = false
  const isParentsMeeting = false
  const isPlanning = false

  const [documentTitle, setDocumentTitle] = useState(initialDocumentTitle)
  const [useUnifiedAnnotations, setUseUnifiedAnnotations] = useState(navData.useUnifiedAnnotations === true)
  const [includeUnifiedClassNotes, setIncludeUnifiedClassNotes] = useState(navData.includeUnifiedClassNotes === true)
  const [includeUnifiedChildNotes, setIncludeUnifiedChildNotes] = useState(navData.includeUnifiedChildNotes === true)
  const [childAnnotationMode, setChildAnnotationMode] = useState<ChildAnnotationMode>(
    typeof navData.studentId === 'string' ? 'one' : 'all',
  )
  const [selectedCustomCategories, setSelectedCustomCategories] = useState<string[]>([])
  const [mode, setMode] = useState<ReportMode>('annotations')
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [ignoredNotes, setIgnoredNotes] = useState('')
  const [blankContext, setBlankContext] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [attachments, setAttachments] = useState<ReportAttachment[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [portfolioOutput, setPortfólioOutput] = useState<PortfólioOutput>('text')
  const [portfolioImageFormat, setPortfolioImageFormat] = useState<PortfolioImageFormat>('portrait')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [savedContent, setSavedContent] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState('')
  const [reportId, setReportId] = useState('')
  const [editingDocument, setEditingDocument] = useState(false)
  const [savingDocument, setSavingDocument] = useState(false)
  const [usageMessage, setUsageMessage] = useState('')
  const [usageError, setUsageError] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [bnccFields, setBnccFields] = useState<string[]>([])
  const [objective, setObjective] = useState('')
  const [evaluationPeriod, setEvaluationPeriod] = useState('')
  const [finalConsiderations, setFinalConsiderations] = useState('')
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<string[]>([])
  const [includeDayAnnotations, setIncludeDayAnnotations] = useState(true)
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [meetingDuration, setMeetingDuration] = useState('1h30')
  const [meetingAgenda, setMeetingAgenda] = useState('')
  const [livingReport, setLivingReport] = useState(false)
  const [latestReportId, setLatestReportId] = useState('')
  const [latestReportBody, setLatestReportBody] = useState('')
  const [loadingLatest, setLoadingLatest] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftKeyRef = useRef('')
  const loadedDraftRef = useRef(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  async function acquireWakeLock() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
      if (!nav.wakeLock) return
      wakeLockRef.current = await nav.wakeLock.request('screen')
    } catch {
      // Wake Lock não disponível neste dispositivo — continua sem
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  const studentAnnotations = useMemo(() => {
    if (isClassDiary || isParentsMeeting || isPlanning) {
      return annotations.filter((annotation) => matchesClass(annotation, selectedClass?.id) && !annotation.studentId)
    }
    return annotations.filter((annotation) => matchesStudent(annotation, selectedStudentId, selectedStudent?.name))
  }, [annotations, isClassDiary, isParentsMeeting, isPlanning, selectedClass?.id, selectedStudentId, selectedStudent?.name])
  const customAnnotationCategories = useMemo(() => {
    const systemLabels = new Set([
      'registro da turma',
      'registro de uma crianca',
      'registro de uma criança',
      'planejamento',
      'anotacao pessoal',
      'anotação pessoal',
      'anotacao direta',
      'anotação direta',
      'transcricao de audio',
      'transcrição de áudio',
    ])
    const values = new Set<string>()
    for (const annotation of annotations) {
      for (const value of [annotation.label, ...(annotation.tags ?? [])]) {
        const clean = value?.trim()
        if (!clean) continue
        if (systemLabels.has(normalize(clean))) continue
        values.add(clean)
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [annotations])
  const unifiedAnnotations = useMemo(() => {
    if (!useUnifiedAnnotations) return []
    const selectedClassStudentIds = new Set(selectedClass?.students.map((student) => student.id) ?? [])
    const selectedClassStudentNames = new Set(selectedClass?.students.map((student) => student.name) ?? [])
    const selectedCategories = new Set(selectedCustomCategories.map((item) => normalize(item)))
    const picked = annotations.filter((annotation) => {
      const isClassNote = includeUnifiedClassNotes && matchesClass(annotation, selectedClass?.id) && !annotation.studentId
      const isChildNote = includeUnifiedChildNotes && (
        childAnnotationMode === 'one'
          ? matchesStudent(annotation, selectedStudentId, selectedStudent?.name)
          : Boolean(
              (annotation.studentId && selectedClassStudentIds.has(annotation.studentId))
              || (annotation.studentName && selectedClassStudentNames.has(annotation.studentName)),
            )
      )
      const isCustomCategory = selectedCategories.size > 0 && [annotation.label, ...(annotation.tags ?? [])]
        .some((value) => selectedCategories.has(normalize(value)))
      return isClassNote || isChildNote || isCustomCategory
    })
    return dedupeAnnotations(picked)
  }, [
    annotations,
    childAnnotationMode,
    includeUnifiedChildNotes,
    includeUnifiedClassNotes,
    selectedClass?.id,
    selectedClass?.students,
    selectedCustomCategories,
    selectedStudent?.name,
    selectedStudentId,
    useUnifiedAnnotations,
  ])
  const selectedAnnotations = isUnifiedCreator
    ? unifiedAnnotations
    : studentAnnotations.filter((annotation) => selectedAnnotationIds.includes(annotation.id))
  const milestoneAnnotations = useMemo(() => {
    const filtered = studentAnnotations.filter((annotation) => {
      const text = normalize(`${annotation.label} ${annotation.text}`)
      return text.includes('marco') || text.includes('evolucao') || text.includes('portfolio') || text.includes('conquista')
    })
    return filtered.length ? filtered : studentAnnotations
  }, [studentAnnotations])
  const selectedMilestones = milestoneAnnotations.filter((annotation) => selectedMilestoneIds.includes(annotation.id))
  const firstName = selectedStudent?.name.split(' ')[0] ?? 'A criança'
  const supportsLivingReport = !isUnifiedCreator && isDevelopmentReport
  const needsBnccFields = !isUnifiedCreator && isPlanning
  const needsAgeGroup = !isUnifiedCreator && isPlanning
  const needsObjective = !isUnifiedCreator && isPlanning
  const needsEvaluationPeriod = !isUnifiedCreator && isDevelopmentReport
  const effectiveDocumentTitle = documentTitle.trim()
  const currentReportType = getReportGenerationType(portfolioOutput)
  const hasContentBase = effectiveDocumentTitle.length >= 3
    && extraContext.trim().length >= 10
    && (!useUnifiedAnnotations || unifiedAnnotations.length > 0)
  const canGenerate = hasContentBase
  const generationRequirementHint = getGenerationRequirementHint({
    isUnifiedCreator: true,
    documentTitleLength: effectiveDocumentTitle.length,
    useUnifiedAnnotations,
    unifiedAnnotationsCount: unifiedAnnotations.length,
    extraContextLength: extraContext.trim().length,
  })
  const generationViewKey = generated ? 'result' : generating ? 'loading' : 'form'
  const voiceAnnotations = useMemo(
    () => studentAnnotations.filter((annotation) => (annotation.tags ?? []).some((tag) => normalize(tag).includes('transcrição'))),
    [studentAnnotations],
  )

  useEffect(() => {
    setSelectedAnnotationIds(studentAnnotations.map((annotation) => annotation.id))
    setGenerated(false)
    setSavedContent('')
    setEditableContent('')
    setGeneratedImageUrl('')
    setReportId('')
    setEditingDocument(false)
    setUsageMessage('')
    setUsageError('')
    setAgeGroup('')
    setBnccFields([])
    setObjective('')
    setEvaluationPeriod('')
    setFinalConsiderations('')
    setSelectedMilestoneIds([])
    setIncludeDayAnnotations(true)
    setLivingReport(false)
    setLatestReportId('')
    setLatestReportBody('')
    setHistoryScope('model')
    setPortfolioImageFormat('portrait')
  }, [selectedStudentId])

  useEffect(() => {
    if (loadedDraftRef.current) return
    const key = `approf:draft:report:${userId}:${reportKind}`
    draftKeyRef.current = key
    const draft = loadDraft<{
      selectedStudentId: string
      selectedClassId: string
      historyScope: 'model' | 'student'
      diaryDate: string
      diaryTheme: string
      diaryRawText: string
      mode: ReportMode
      selectedAnnotationIds: string[]
      ignoredNotes: string
      blankContext: string
      extraContext: string
      portfolioOutput: PortfólioOutput
      portfolioImageFormat: PortfolioImageFormat
      ageGroup: string
      bnccFields: string[]
      objective: string
      evaluationPeriod: string
      finalConsiderations: string
      selectedMilestoneIds: string[]
      includeDayAnnotations: boolean
      meetingDate: string
      meetingDuration: string
      meetingAgenda: string
      livingReport: boolean
    }>(key)
    if (draft) {
      setSelectedStudentId(draft.selectedStudentId || fallbackStudentId)
      setSelectedClassId(draft.selectedClassId || defaultClassId)
      setHistoryScope(draft.historyScope || 'model')
      setDiaryDate(draft.diaryDate || new Date().toISOString().slice(0, 10))
      setDiaryTheme(draft.diaryTheme || '')
      setDiaryRawText(draft.diaryRawText || '')
      setMode(draft.mode || 'annotations')
      setSelectedAnnotationIds(draft.selectedAnnotationIds || [])
      setIgnoredNotes(draft.ignoredNotes || '')
      setBlankContext(draft.blankContext || '')
      setExtraContext(draft.extraContext || '')
      setPortfólioOutput(draft.portfolioOutput || 'text')
      setPortfolioImageFormat(draft.portfolioImageFormat || 'portrait')
      setAgeGroup(draft.ageGroup || '')
      setBnccFields(draft.bnccFields || [])
      setObjective(draft.objective || '')
      setEvaluationPeriod(draft.evaluationPeriod || '')
      setFinalConsiderations(draft.finalConsiderations || '')
      setSelectedMilestoneIds(draft.selectedMilestoneIds || [])
      setIncludeDayAnnotations(draft.includeDayAnnotations !== false)
      setMeetingDate(draft.meetingDate || new Date().toISOString().slice(0, 10))
      setMeetingDuration(draft.meetingDuration || '1h30')
      setMeetingAgenda(draft.meetingAgenda || '')
      setLivingReport(Boolean(draft.livingReport))
      setDraftMessage('Rascunho recuperado')
    }
    loadedDraftRef.current = true
  }, [defaultClassId, fallbackStudentId, reportKind, userId])

  useEffect(() => {
    if (!loadedDraftRef.current || !draftKeyRef.current) return
    if (generated || generating) return
    const timeout = window.setTimeout(() => {
      saveDraft(draftKeyRef.current, {
        selectedStudentId,
        selectedClassId,
        historyScope,
        diaryDate,
        diaryTheme,
        diaryRawText,
        mode,
        selectedAnnotationIds,
        ignoredNotes,
        blankContext,
        extraContext,
        portfolioOutput,
        portfolioImageFormat,
        ageGroup,
        bnccFields,
        objective,
        evaluationPeriod,
        finalConsiderations,
        selectedMilestoneIds,
        includeDayAnnotations,
        meetingDate,
        meetingDuration,
        meetingAgenda,
        livingReport,
      })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [
    ageGroup,
    blankContext,
    bnccFields,
    diaryDate,
    diaryRawText,
    diaryTheme,
    evaluationPeriod,
    extraContext,
    finalConsiderations,
    generated,
    generating,
    historyScope,
    includeDayAnnotations,
    ignoredNotes,
    livingReport,
    meetingAgenda,
    meetingDate,
    meetingDuration,
    mode,
    objective,
    portfolioImageFormat,
    portfolioOutput,
    selectedAnnotationIds,
    selectedClassId,
    selectedMilestoneIds,
    selectedStudentId,
  ])

  useEffect(() => {
    if (!draftMessage) return
    const timeout = window.setTimeout(() => setDraftMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [draftMessage])

  useEffect(() => {
    if (!supportsLivingReport || !selectedStudent?.id) return
    let active = true
    setLoadingLatest(true)
    listReports({ studentId: selectedStudent.id, limit: 40 })
      .then((items) => {
        if (!active) return
        const latest = items.find((item) => item.report_type === currentReportType && item.status !== 'archived')
        setLatestReportId(latest?.id ?? '')
        setLatestReportBody(latest?.body ?? '')
      })
      .catch(() => {
        if (!active) return
        setLatestReportId('')
        setLatestReportBody('')
      })
      .finally(() => {
        if (active) setLoadingLatest(false)
      })
    return () => {
      active = false
    }
  }, [supportsLivingReport, selectedStudent?.id, currentReportType])

  useEffect(() => {
    if (assistantMode !== 'parents-meeting') return
    setMode('blank')
  }, [assistantMode])

  // On mount: check if a previous generation was interrupted (page reloaded)
  useEffect(() => {
    const ts = localStorage.getItem('approf:generating')
    if (!ts) return
    const elapsed = Date.now() - parseInt(ts, 10)
    localStorage.removeItem('approf:generating')
    if (elapsed > 25000) {
      setUsageError('A geração anterior foi interrompida (tela bloqueada ou app fechado). Configure os campos e tente novamente.')
    }
  }, [])

  // Re-acquire Wake Lock when the tab/screen becomes visible again during generation
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      if (generating) void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [generating])

  const mockReport = createReportPreview({
    reportKind,
    studentName: isClassDiary || isParentsMeeting ? '-' : (selectedStudent?.name ?? '-'),
    className: isClassDiary || isParentsMeeting ? (selectedClass?.name ?? '-') : (selectedStudent?.className ?? '-'),
    firstName,
    mode,
    selectedAnnotations,
    ignoredNotes,
    blankContext,
    extraContext,
    attachments,
    portfolioOutput,
    portfolioImageFormat,
    diaryDate,
    diaryTheme,
    diaryRawText,
    finalConsiderations,
    selectedMilestones,
    includeDayAnnotations,
    meetingDate,
    meetingDuration,
    meetingAgenda,
  })

  function handleBack() {
    if (generated && editingDocument && editableContent !== savedContent) {
      const discard = window.confirm('Você tem alterações não salvas. Deseja sair sem salvar?')
      if (!discard) return
    }
    closeSubscreen()
  }

  function toggleAnnotation(id: string) {
    setSelectedAnnotationIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function selectAllAnnotations() {
    setSelectedAnnotationIds(studentAnnotations.map((annotation) => annotation.id))
  }

  function clearAnnotations() {
    setSelectedAnnotationIds([])
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files?.length) return

    const selectedFiles = Array.from(files)
    const selected = await Promise.all(selectedFiles.map(async (file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      isImage: isImageFile(file),
      dataUrl: isImageFile(file) ? await fileToDataUrl(file) : undefined,
      extractedText: await extractAttachmentText(file),
    })))

    if (!isUnifiedCreator && isSupabaseConfigured() && selectedStudent?.id) {
      setUploadingAttachments(true)
      setUsageError('')
      try {
        const uploaded = await uploadChildPortfolioMedia(selectedStudent.id, selectedFiles)
        const uploadedWithImages = uploaded.map((item, index) => ({
          ...item,
          dataUrl: selected[index]?.dataUrl,
        }))
        setAttachments((current) => {
          const existing = new Set(current.map((item) => item.storagePath ?? item.id))
          return [...current, ...uploadedWithImages.filter((item) => !existing.has(item.storagePath))]
        })
        setDraftMessage('Anexo enviado para o portfólio privado.')
        return
      } catch (error) {
        setUsageError(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel enviar o anexo do portfÃ³lio.')
        return
      } finally {
        setUploadingAttachments(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }

    setAttachments((current) => {
      const existing = new Set(current.map((item) => item.id))
      return [...current, ...selected.filter((item) => !existing.has(item.id))]
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePortfolioInputChange(event: ChangeEvent<HTMLInputElement>) {
    setUsageError('')
    void handleFiles(event.currentTarget.files)
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  function resetReportFormAfterGeneration() {
    setSelectedAnnotationIds([])
    setIgnoredNotes('')
    setBlankContext('')
    setExtraContext('')
    setAttachments([])
    setDiaryTheme('')
    setDiaryRawText('')
    setAgeGroup('')
    setBnccFields([])
    setObjective('')
    setEvaluationPeriod('')
    setFinalConsiderations('')
    setSelectedMilestoneIds([])
    setIncludeDayAnnotations(true)
    setMeetingAgenda('')
    setLivingReport(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function generate() {
    if (!canGenerate) return
    setUsageError('')
    setUsageMessage('')
    setGenerating(true)
    setSavedContent('')
    setEditableContent('')
    setGeneratedImageUrl('')
    setReportId('')
    setEditingDocument(false)

    void acquireWakeLock()
    localStorage.setItem('approf:generating', String(Date.now()))

    try {
      const styleSettings = loadDocumentStyleSettings()
      const requestClassId = isUnifiedCreator
        ? (useUnifiedAnnotations && (includeUnifiedClassNotes || includeUnifiedChildNotes) ? (selectedClass?.id ?? null) : null)
        : isClassDiary || isParentsMeeting
          ? (selectedClass?.id ?? null)
          : (selectedStudent?.classId ?? null)
      const requestStudentId = isUnifiedCreator
        ? (useUnifiedAnnotations && includeUnifiedChildNotes && childAnnotationMode === 'one' ? (selectedStudent?.id ?? null) : null)
        : isClassDiary || isParentsMeeting
          ? null
          : (selectedStudent?.id ?? null)
      const requestSummary = {
        reportKind: effectiveDocumentTitle || 'Documento pedagógico',
        documentTitle: effectiveDocumentTitle || null,
        unifiedCreator: true,
        documentOutput: portfolioOutput,
        portfolioOutput,
        portfolioImageFormat,
        historyScope,
        mode: isUnifiedCreator
          ? (useUnifiedAnnotations ? 'annotations' : 'blank')
          : mode,
        studentName: requestStudentId ? (selectedStudent?.name ?? null) : null,
        className: requestClassId ? (selectedClass?.name ?? selectedStudent?.className ?? null) : null,
        ageGroup: ageGroup || null,
        bnccFields,
        objective: objective || null,
        evaluationPeriod: evaluationPeriod || null,
        finalConsiderations: finalConsiderations || null,
        selectedMilestones: selectedMilestones.map((annotation) => ({
          date: annotation.date,
          label: annotation.label,
          text: annotation.text,
        })),
        includeDayAnnotations,
        diaryDate: isClassDiary ? diaryDate : null,
        diaryTheme: isClassDiary ? (diaryTheme || null) : null,
        diaryRawText: isClassDiary ? diaryRawText : null,
        meetingDate: isParentsMeeting ? meetingDate : null,
        meetingDuration: isParentsMeeting ? meetingDuration : null,
        meetingAgenda: isParentsMeeting ? meetingAgenda : null,
        assistantMode: assistantMode || null,
        livingReport,
        voiceAnnotationsCount: voiceAnnotations.length,
        annotationSources: isUnifiedCreator ? {
          useAnnotations: useUnifiedAnnotations,
          classNotes: includeUnifiedClassNotes,
          childNotes: includeUnifiedChildNotes,
          childMode: childAnnotationMode,
          customCategories: selectedCustomCategories,
        } : null,
        useAnnotations: isUnifiedCreator ? useUnifiedAnnotations : mode === 'annotations',
        selectedAnnotations: selectedAnnotations.map((annotation) => ({
          date: annotation.date,
          label: annotation.label,
          text: annotation.text,
        })),
        ignoredNotes,
        blankContext: isUnifiedCreator ? '' : blankContext,
        extraContext: extraContext.trim(),
        attachments: attachments.map((item) => ({
          name: item.name,
          type: item.type,
          size: item.size,
          hasImageInPortfolio: item.isImage && Boolean(item.dataUrl),
          extractedText: item.extractedText,
        })),
        documentStyle: styleSettings,
      }

      const generationType = getReportGenerationType(portfolioOutput)
      const rawPhotoDataUrl = generationType === 'portfolio_image'
        ? (attachments.find((item) => item.isImage && item.dataUrl)?.dataUrl ?? null)
        : null
      const primaryPhotoDataUrl = rawPhotoDataUrl
        ? await resizeImageForPortfolio(rawPhotoDataUrl)
        : null
      const result = generationType === 'portfolio_image'
        ? await generateAiPortfolioImage({
            generationType,
            classId: requestClassId,
            studentId: requestStudentId,
            promptVersion: 'portfolio-image-v1',
            requestSummary,
            primaryPhotoDataUrl,
          })
        : await generateAiTextDocument({
            generationType,
            classId: requestClassId,
            studentId: requestStudentId,
            promptVersion: 'criador-livre-v1',
            requestSummary,
          })

      if (!result.allowed) {
        releaseWakeLock()
        localStorage.removeItem('approf:generating')
        setUsageError(result.message || 'Esta geração precisa de pacote extra.')
        setGenerating(false)
        return
      }
      if (generationType === 'portfolio_image' && !('imageDataUrl' in result && result.imageDataUrl)) {
        throw new Error('Não foi possível obter a imagem do portfólio. Tente novamente.')
      }

      setUsageMessage(formatAiUsageMessage(result))
      const generatedBody = 'generatedText' in result && result.generatedText
        ? result.generatedText
        : 'prompt' in result && result.prompt
          ? `Imagem de portfólio gerada com sucesso.\n\nDescrição usada:\n\n${result.prompt}`
          : mockReport
      const nextImageUrl = 'imageDataUrl' in result && result.imageDataUrl ? result.imageDataUrl : ''
      let nextBody = generationType === 'portfolio_text'
        ? appendPortfolioImagesToBody(generatedBody, attachments, selectedStudent?.name ?? 'Criança')
        : generatedBody
      let nextReportId = result.reportId ?? ''

      if (
        livingReport &&
        latestReportId &&
        generationType !== 'portfolio_image' &&
        nextBody.trim().length > 0
      ) {
        const mergedBody = mergeLivingReport(latestReportBody, nextBody)
        const updatedLiving = await updateReport(latestReportId, { body: mergedBody, status: 'ready' })
        nextBody = updatedLiving.body ?? mergedBody
        nextReportId = updatedLiving.id
      }

      setSavedContent(nextBody)
      setEditableContent(nextBody)
      setGeneratedImageUrl(nextImageUrl)
      setReportId(nextReportId)
      window.setTimeout(() => {
        releaseWakeLock()
        localStorage.removeItem('approf:generating')
        celebrateAiGeneration()
        setGenerating(false)
        setGenerated(true)
      }, 900)
      if (draftKeyRef.current) {
        clearDraft(draftKeyRef.current)
      }
      resetReportFormAfterGeneration()
    } catch (error) {
      releaseWakeLock()
      localStorage.removeItem('approf:generating')
      setGenerating(false)
      setUsageError(error instanceof Error ? error.message : 'Não foi possível gerar agora.')
    }
  }

  async function saveDocument() {
    if (!reportId) {
      setUsageError('O documento ainda não foi salvo no backend.')
      return
    }

    setSavingDocument(true)
    setUsageError('')
    try {
      const updated = await updateReport(reportId, { body: editableContent, status: 'ready' })
      setSavedContent(updated.body ?? '')
      setEditableContent(updated.body ?? '')
      setEditingDocument(false)
      setUsageMessage('Documento salvo com sucesso.')
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Não foi possível salvar o documento.')
    } finally {
      setSavingDocument(false)
    }
  }

  async function archiveDocument() {
    if (!reportId) return
    const confirmed = window.confirm('Deseja arquivar este documento?')
    if (!confirmed) return

    setSavingDocument(true)
    setUsageError('')
    try {
      await updateReport(reportId, { archive: true })
      setUsageMessage('Documento arquivado.')
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Não foi possível arquivar o documento.')
    } finally {
      setSavingDocument(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={handleBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Criador Pedagógico</span>
      </div>

      <div key={generationViewKey} className="scroll-area px-[18px] stage-fade-in">
        {!generated ? (
          generating ? (
            currentReportType === 'portfolio_image'
              ? <GenerationImageLoadingScreen />
              : <GenerationDocumentLoadingScreen variant={resolveDocumentLoadingVariant(effectiveDocumentTitle || reportKind)} />
          ) : (
          <div className="py-5">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-[14px] bg-gbg border border-gp flex items-center justify-center">
                  <Sparkles size={22} color="#4F8341" strokeWidth={1.7} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Antes de gerar</h2>
                  <p className="text-[12px] text-muted leading-snug">
                    Informe o título, escolha texto ou imagem, use anotações se quiser e descreva exatamente o que precisa.
                  </p>
                </div>
              </div>

              {isUnifiedCreator ? (
                <>
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Título do que você precisa
                  </label>
                  <input
                    className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none"
                    placeholder="Ex: Planejamento semanal da turma, relatório da Maria, portfólio visual..."
                    value={documentTitle}
                    onChange={(event) => setDocumentTitle(event.target.value)}
                  />

                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4 mb-2">
                    Formato de saída
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPortfólioOutput('text')}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        portfolioOutput === 'text' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                      }`}
                    >
                      <span className="block text-[13px] font-bold">Texto</span>
                      <span className="block text-[11px] mt-1">Relatório, planejamento, portfólio escrito</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortfólioOutput('image')}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        portfolioOutput === 'image' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                      }`}
                    >
                      <span className="block text-[13px] font-bold">Imagem</span>
                      <span className="block text-[11px] mt-1">Capa ou painel visual</span>
                    </button>
                  </div>

                  {portfolioOutput === 'image' && (
                    <div className="mt-3">
                      <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                        Orientação da imagem
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'portrait', label: 'Retrato A4', preview: '▮' },
                          { id: 'landscape', label: 'Paisagem A4', preview: '▬' },
                          { id: 'square', label: 'Quadrado', preview: '■' },
                        ] as const).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPortfolioImageFormat(item.id)}
                            className={`rounded-app-sm border px-2 py-3 text-center ${
                              portfolioImageFormat === item.id
                                ? 'bg-gbg border-gp text-gd'
                                : 'bg-cream border-border text-muted'
                            }`}
                          >
                            <span className="block text-[18px] leading-none">{item.preview}</span>
                            <span className="block text-[11px] font-bold mt-2">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </>
              ) : isClassDiary || isParentsMeeting ? (
                <>
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Turma
                  </label>
                  <select
                    className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  {isClassDiary && (
                    <>
                      <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                        Data
                      </label>
                      <input
                        type="date"
                        className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
                        value={diaryDate}
                        onChange={(event) => setDiaryDate(event.target.value)}
                      />
                      <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                        Tema do dia (opcional)
                      </label>
                      <input
                        className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
                        placeholder="Ex: coordenação motora, música, socialização, brincadeiras no parque..."
                        value={diaryTheme}
                        onChange={(event) => setDiaryTheme(event.target.value)}
                      />
                      <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                        Relato da professora
                      </label>
                      <textarea
                        className="w-full min-h-[150px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                        placeholder="Conte como foi o dia da turma: quais atividades aconteceram, quem se destacou, que situações chamaram sua atenção e quais conquistas ou desafios apareceram."
                        value={diaryRawText}
                        onChange={(event) => setDiaryRawText(event.target.value)}
                      />
                      <button
                        onClick={() => setIncludeDayAnnotations((current) => !current)}
                        className={`w-full rounded-app-sm border px-3 py-3 text-left mt-4 ${
                          includeDayAnnotations ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'
                        }`}
                      >
                        <span className="block text-[13px] font-bold">
                          {includeDayAnnotations ? '[x] ' : '[ ] '}
                          Puxar anotações
                        </span>
                        <span className="block text-[11px] mt-1">
                          Incluir registros do dia como contexto do diário.
                        </span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Criança
                  </label>
                  <select
                    className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                  >
                    {allStudents.map((student) => (
                      <option key={`${student.classId}-${student.id}`} value={student.id}>
                        {student.name} - {student.className}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {isUnifiedCreator && (
              <>
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                    Anotações
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setUseUnifiedAnnotations(false)
                        setIncludeUnifiedClassNotes(false)
                        setIncludeUnifiedChildNotes(false)
                        setSelectedCustomCategories([])
                      }}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        !useUnifiedAnnotations ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                      }`}
                    >
                      <span className="block text-[13px] font-bold">Não usar</span>
                      <span className="block text-[11px] mt-1">Criar só pelo pedido</span>
                    </button>
                    <button
                      onClick={() => setUseUnifiedAnnotations(true)}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        useUnifiedAnnotations ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                      }`}
                    >
                      <span className="block text-[13px] font-bold">Usar anotações</span>
                      <span className="block text-[11px] mt-1">Escolher fontes</span>
                    </button>
                  </div>

                  {useUnifiedAnnotations && (
                    <div className="mt-4 space-y-3">
                      <SourceToggle
                        selected={includeUnifiedClassNotes}
                        title="Anotações da turma"
                        desc="Usa registros coletivos vinculados à turma selecionada."
                        onClick={() => setIncludeUnifiedClassNotes((current) => !current)}
                      />
                      <SourceToggle
                        selected={includeUnifiedChildNotes}
                        title="Anotações das crianças"
                        desc="Usa registros das crianças da turma ou de uma criança específica."
                        onClick={() => setIncludeUnifiedChildNotes((current) => !current)}
                      />

                      {(includeUnifiedClassNotes || includeUnifiedChildNotes) && (
                        <div>
                          <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                            Turma
                          </label>
                          <select
                            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 text-[14px] outline-none"
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                          >
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-muted leading-[1.5] mt-2">
                            A turma só será usada para localizar as anotações que você escolher.
                          </p>
                        </div>
                      )}

                      {includeUnifiedChildNotes && (
                        <div className="rounded-app-sm border border-border bg-cream p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setChildAnnotationMode('all')}
                              className={`rounded-app-sm border px-3 py-2 text-[12px] font-bold ${
                                childAnnotationMode === 'all' ? 'bg-gd text-white border-gd' : 'bg-white text-muted border-border'
                              }`}
                            >
                              Turma toda
                            </button>
                            <button
                              onClick={() => setChildAnnotationMode('one')}
                              className={`rounded-app-sm border px-3 py-2 text-[12px] font-bold ${
                                childAnnotationMode === 'one' ? 'bg-gd text-white border-gd' : 'bg-white text-muted border-border'
                              }`}
                            >
                              Uma criança
                            </button>
                          </div>
                          {childAnnotationMode === 'one' && (
                            <select
                              className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-3 text-[14px] outline-none"
                              value={selectedStudentId}
                              onChange={(event) => setSelectedStudentId(event.target.value)}
                            >
                              {allStudents
                                .filter((student) => student.classId === selectedClassId)
                                .map((student) => (
                                  <option key={`${student.classId}-${student.id}`} value={student.id}>
                                    {student.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      )}

                      {customAnnotationCategories.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                            Categorias criadas
                          </p>
                          <div className="flex flex-col gap-2">
                            {customAnnotationCategories.map((category) => {
                              const selected = selectedCustomCategories.includes(category)
                              return (
                                <button
                                  key={category}
                                  onClick={() => setSelectedCustomCategories((current) =>
                                    current.includes(category)
                                      ? current.filter((item) => item !== category)
                                      : [...current, category],
                                  )}
                                  className={`rounded-app-sm border px-3 py-3 text-left text-[12px] font-bold ${
                                    selected ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                                  }`}
                                >
                                  {selected ? '[x] ' : '[ ] '}
                                  {category}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-muted leading-[1.5]">
                        {unifiedAnnotations.length} anotações serão usadas como contexto.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    O que você quer criar?
                  </label>
                  <textarea
                    className="w-full min-h-[180px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                    placeholder="Explique o que deseja criar, o tom do texto, informações importantes, o que deve aparecer, o que precisa remover e qualquer padrão que deseja seguir."
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                  />
                </div>
              </>
            )}

            {!isUnifiedCreator && isDevelopmentReport && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  Informações da criança e professora
                </p>
                <div className="space-y-2 text-[13px] text-ink leading-[1.5]">
                  <p><strong>Criança:</strong> {selectedStudent?.name ?? '-'}</p>
                  <p><strong>Turma:</strong> {selectedStudent?.className ?? '-'}</p>
                  <p><strong>Professora:</strong> dados da conta da professora</p>
                </div>
              </div>
            )}

            {!isUnifiedCreator && isParentsMeeting && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  Estrutura da reunião
                </p>
                <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                  Data
                </label>
                <input
                  type="date"
                  className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
                  value={meetingDate}
                  onChange={(event) => setMeetingDate(event.target.value)}
                />
                <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                  Duração estimada
                </label>
                <select
                  className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
                  value={meetingDuration}
                  onChange={(event) => setMeetingDuration(event.target.value)}
                >
                  <option value="1h">1h</option>
                  <option value="1h30">1h30</option>
                  <option value="2h">2h</option>
                </select>
                <MeetingTextArea
                  label="Pauta da reunião"
                  value={meetingAgenda}
                  onChange={setMeetingAgenda}
                  placeholder="Liste os itens da pauta e, se quiser, o tempo sugerido para cada um. Ex: apresentação do bimestre, conquistas da turma, combinados de rotina, dúvidas das famílias..."
                />
              </div>
            )}

            {!isUnifiedCreator && !isClassDiary && !isParentsMeeting && (needsBnccFields || needsObjective || needsEvaluationPeriod) && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  {isDevelopmentReport ? 'Período avaliado' : 'Dados BNCC obrigatorios'}
                </p>

                {needsBnccFields && (
                  <>
                    {needsAgeGroup && (
                      <>
                        <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                          Faixa etária
                        </label>
                        <select
                          className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
                          value={ageGroup}
                          onChange={(event) => setAgeGroup(event.target.value)}
                        >
                          <option value="">Selecionar faixa etária</option>
                          {AGE_GROUP_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4 mb-2">
                      Campos de experiencia BNCC
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {BNCC_FIELD_OPTIONS.map((item) => {
                        const selected = bnccFields.includes(item)
                        return (
                          <button
                            key={item}
                            onClick={() => setBnccFields((current) =>
                              current.includes(item)
                                ? current.filter((field) => field !== item)
                                : [...current, item],
                            )}
                            className={`w-full rounded-app-sm border px-3 py-3 text-left text-[12px] font-bold ${
                              selected ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'
                            }`}
                          >
                            {selected ? '[x] ' : '[ ] '}
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {needsObjective && (
                  <>
                    <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                      Objetivo de aprendizagem (BNCC)
                    </label>
                    <textarea
                      className="w-full min-h-[88px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                      placeholder="Ex: EI03TS02 - Expressar-se por desenho, pintura e colagem..."
                      value={objective}
                      onChange={(event) => setObjective(event.target.value)}
                    />
                  </>
                )}

                {needsEvaluationPeriod && (
                  <>
                    <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                      Período de avaliação
                    </label>
                    <input
                      className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none"
                      placeholder="Ex: 1o semestre de 2026"
                      value={evaluationPeriod}
                      onChange={(event) => setEvaluationPeriod(event.target.value)}
                    />
                  </>
                )}
              </div>
            )}

            {!isUnifiedCreator && isDevelopmentReport && (
              <>
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                    Introdução
                  </p>
                  <p className="text-[12px] text-muted leading-[1.6]">
                    O relatório deve informar que a professora usou os documentos norteadores para o desenvolvimento do relatório: BNCC, PPP (Projeto Político Pedagógico) e Currículo da Cidade.
                  </p>
                </div>

                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Considerações finais
                  </label>
                  <textarea
                    className="w-full min-h-[104px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                    placeholder="Escreva uma mensagem final de incentivo e parceria com a família."
                    value={finalConsiderations}
                    onChange={(event) => setFinalConsiderations(event.target.value)}
                  />
                </div>

                <div className="bg-white rounded-app p-4 border border-gp shadow-card mb-4" style={{ background: '#F0FAF4' }}>
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-gd mb-2">
                    Orientação
                  </p>
                  <p className="text-[12px] text-soft leading-[1.6]">
                    O que não pode faltar no texto: para estar alinhado à BNCC, o relatório deve transparecer que a criança teve seus Direitos de Aprendizagem garantidos: ela brincou, conviveu, participou, explorou, expressou-se e conheceu-se.
                  </p>
                </div>
              </>
            )}

            {supportsLivingReport && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                  Relatório vivo
                </p>
                <p className="text-[12px] text-muted leading-[1.6] mb-3">
                  Atualize continuamente o mesmo documento ao invés de criar sempre um novo.
                </p>
                <button
                  onClick={() => setLivingReport((current) => !current)}
                  disabled={!latestReportId || loadingLatest}
                  className={`w-full rounded-app-sm border px-3 py-3 text-left ${
                    livingReport
                      ? 'bg-gbg border-gp text-gd'
                      : 'bg-white border-border text-muted'
                  } disabled:opacity-50`}
                >
                  <span className="block text-[13px] font-bold">
                    {livingReport ? 'Atualizando relatório existente' : 'Criar novo documento'}
                  </span>
                  <span className="block text-[11px] mt-1">
                    {loadingLatest
                      ? 'Buscando último documento...'
                      : latestReportId
                        ? 'Último documento encontrado para esta criança.'
                        : 'Nenhum documento anterior encontrado para este tipo.'}
                  </span>
                </button>
              </div>
            )}

            {!isUnifiedCreator && !isClassDiary && !isParentsMeeting && !isPortfólio && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  Base do documento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('annotations')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      mode === 'annotations' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Usar anotações</span>
                    <span className="block text-[11px] mt-1">Selecionar registros do app</span>
                  </button>
                  <button
                    onClick={() => setMode('blank')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      mode === 'blank' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Começar do zero</span>
                    <span className="block text-[11px] mt-1">Descrever tudo manualmente</span>
                  </button>
                </div>
                {portfolioOutput === 'image' && (
                  <div className="mt-3">
                    <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                      Formato da imagem
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'portrait', label: 'Retrato A4', preview: '▮' },
                        { id: 'landscape', label: 'Paisagem A4', preview: '▬' },
                        { id: 'square', label: 'Quadrado', preview: '■' },
                      ] as const).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setPortfolioImageFormat(item.id)}
                          className={`rounded-app-sm border px-2 py-3 text-center ${
                            portfolioImageFormat === item.id
                              ? 'bg-gbg border-gp text-gd'
                              : 'bg-cream border-border text-muted'
                          }`}
                        >
                          <span className="block text-[18px] leading-none">{item.preview}</span>
                          <span className="block text-[11px] font-bold mt-2">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isUnifiedCreator && isPortfólio && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  Tipo de portfólio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPortfólioOutput('text')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      portfolioOutput === 'text' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Portfólio em texto</span>
                    <span className="block text-[11px] mt-1">Narrativa pedagógica e evidências</span>
                  </button>
                  <button
                    onClick={() => setPortfólioOutput('image')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      portfolioOutput === 'image' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Portfólio em imagem</span>
                    <span className="block text-[11px] mt-1">Capa ou painel visual</span>
                  </button>
                </div>
              </div>
            )}

            {!isUnifiedCreator && !isClassDiary && !isParentsMeeting && !isPortfólio && !isDevelopmentReport && (
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                Histórico
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setHistoryScope('model')}
                  className={`rounded-app-sm border px-3 py-3 text-left ${
                    historyScope === 'model'
                      ? 'border-gp bg-gbg text-gd'
                      : 'border-border bg-cream text-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">Este modelo</span>
                  <span className="block text-[11px] mt-1">Usar histórico geral do modelo</span>
                </button>
                <button
                  onClick={() => setHistoryScope('student')}
                  disabled={!selectedStudent?.id}
                  className={`rounded-app-sm border px-3 py-3 text-left disabled:opacity-50 ${
                    historyScope === 'student'
                      ? 'border-gp bg-gbg text-gd'
                      : 'border-border bg-cream text-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">Desta criança</span>
                  <span className="block text-[11px] mt-1">Usar apenas o contexto da criança selecionada</span>
                </button>
              </div>
            </div>
            )}

            {!isUnifiedCreator && isPortfólio && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[13px] font-bold text-ink">Marcos importantes</p>
                    <p className="text-[11px] text-muted">{selectedMilestones.length} de {milestoneAnnotations.length} selecionados</p>
                  </div>
                </div>
                <p className="text-[12px] text-muted leading-[1.6] mb-3">
                  Selecione os marcos que deseja que apareçam no portfólio.
                </p>
                <div className="flex flex-col gap-2">
                  {milestoneAnnotations.length ? milestoneAnnotations.map((annotation) => (
                    <button
                      key={annotation.id}
                      onClick={() => setSelectedMilestoneIds((current) =>
                        current.includes(annotation.id)
                          ? current.filter((item) => item !== annotation.id)
                          : [...current, annotation.id],
                      )}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        selectedMilestoneIds.includes(annotation.id)
                          ? 'bg-gbg border-gp'
                          : 'bg-cream border-border'
                      }`}
                    >
                      <span className="block text-[12px] font-bold text-ink">
                        {selectedMilestoneIds.includes(annotation.id) ? '[x] ' : '[ ] '}
                        {annotation.label} - {annotation.date}
                      </span>
                      <span className="block text-[11px] text-muted leading-[1.5] mt-1">{annotation.text}</span>
                    </button>
                  )) : (
                    <p className="text-[12px] text-muted leading-[1.6]">
                      Nenhum marco registrado ainda para esta criança.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!isUnifiedCreator && !isClassDiary && !isParentsMeeting && !isPortfólio && (mode === 'annotations' ? (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[13px] font-bold text-ink">Anotações base de {firstName}</p>
                    <p className="text-[11px] text-muted">{selectedAnnotations.length} de {studentAnnotations.length} selecionadas</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={selectAllAnnotations} className="text-[11px] font-bold text-gm">Todas</button>
                    <button onClick={clearAnnotations} className="text-[11px] font-bold text-muted">Limpar</button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {studentAnnotations.length ? studentAnnotations.map((annotation) => (
                    <button
                      key={annotation.id}
                      onClick={() => toggleAnnotation(annotation.id)}
                      className={`rounded-app-sm border px-3 py-3 text-left ${
                        selectedAnnotationIds.includes(annotation.id)
                          ? 'bg-gbg border-gp'
                          : 'bg-cream border-border'
                      }`}
                    >
                      <span className="block text-[12px] font-bold text-ink">
                        {selectedAnnotationIds.includes(annotation.id) ? '[x] ' : '+ '}
                        {annotation.label} - {annotation.date}
                      </span>
                      <span className="block text-[11px] text-muted leading-[1.5] mt-1">{annotation.text}</span>
                    </button>
                  )) : (
                    <p className="text-[12px] text-muted leading-[1.6]">
                      Ainda não há anotações vinculadas a esta criança. Você pode começar do zero ou incluir orientações abaixo.
                    </p>
                  )}
                </div>

                {voiceAnnotations.length > 0 && (
                  <div className="mt-3 rounded-app-sm border border-gp bg-gbg p-3">
                    <p className="text-[11px] font-bold text-gd">
                      {voiceAnnotations.length} anotações por voz detectadas
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setSelectedAnnotationIds(voiceAnnotations.map((annotation) => annotation.id))}
                        className="px-3 py-2 rounded-full text-[11px] font-bold border border-gp bg-white text-gm"
                      >
                        Selecionar só voz
                      </button>
                      <button
                        onClick={() => setExtraContext((current) => {
                          const summary = summarizeVoiceAnnotations(voiceAnnotations)
                          return current.trim() ? `${current.trim()}\n${summary}` : summary
                        })}
                        className="px-3 py-2 rounded-full text-[11px] font-bold border border-gp bg-white text-gm"
                      >
                        Inserir resumo de voz
                      </button>
                    </div>
                  </div>
                )}

                <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                  Desconsiderar algo
                </label>
                <textarea
                  className="w-full min-h-[86px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  placeholder="Ex: não considerar a anotação sobre choro da primeira semana, pois já foi superado..."
                  value={ignoredNotes}
                  onChange={(event) => setIgnoredNotes(event.target.value)}
                />
              </div>
            ) : (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                  {isParentsMeeting ? 'Pauta principal' : 'Descrição completa para gerar do zero'}
                </label>
                <textarea
                  className="w-full min-h-[180px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  placeholder={isParentsMeeting
                    ? 'Ex: Apresentação do bimestre e trabalhos realizados, adaptação da turma, combinados sobre rotina e materiais, dúvidas e sugestões das famílias...'
                    : 'Descreva a rotina, evoluções, pontos de atenção, interações, autonomia, linguagem, família, encaminhamentos e o tom desejado para o documento...'}
                  value={blankContext}
                  onChange={(event) => setBlankContext(event.target.value)}
                />
              </div>
            ))}

            {!isUnifiedCreator && isClassDiary && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
                  Histórico do diário
                </p>
                <p className="text-[12px] text-muted leading-[1.6] mb-3">
                  Consulte os diários anteriores da turma em timeline e busca por data.
                </p>
                <button
                  onClick={() => openSubscreen('generated-documents', { reportType: currentReportType, classId: selectedClass?.id })}
                  className="w-full rounded-app-sm border border-gp bg-gbg px-3 py-3 text-left text-gd"
                >
                  <span className="block text-[13px] font-bold">Ver histórico da turma</span>
                  <span className="block text-[11px] mt-1">Registros coletivos já gerados</span>
                </button>
              </div>
            )}

            {!isUnifiedCreator && (
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                {isPortfólio ? 'Instruções para a IA (obrigatório seguir)' : 'Orientações finais para a IA (opcional)'}
              </label>
              {isPortfólio && (
                <p className="text-[11px] text-muted leading-[1.5] mt-1 mb-2">
                  A IA seguirá exatamente o que você escrever aqui: destacar conquistas, remover informações, ajustar o layout, corrigir a imagem — qualquer instrução será respeitada.
                </p>
              )}
              {!isPortfólio && (
                <p className="text-[11px] text-muted leading-[1.5] mt-1 mb-2">
                  A IA seguirá exatamente o que você escrever aqui. Use para dar instruções específicas, destacar situações, nomear crianças em situações concretas ou indicar o tom desejado.
                </p>
              )}
              <textarea
                className="w-full min-h-[118px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                placeholder={isPortfólio
                  ? 'Ex.: "Destaque a evolução na socialização. Não mencionar a semana de adaptação difícil. Usar cores suaves. A foto anexada é da criança fazendo pintura."'
                  : isParentsMeeting
                    ? 'Ex.: reforçar o combinado sobre uniforme, mencionar a festa junina que está chegando, agradecer a participação dos pais na última atividade...'
                    : 'Ex.: Pedro teve dificuldade com as tesouras em março mas superou em abril. Ana adora cantar e se destaca nas rodas. Não mencionar o episódio de choro da semana 1...'}
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
              />
            </div>
            )}

            {!isUnifiedCreator && isPortfólio && (
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-gbg flex items-center justify-center text-gm flex-shrink-0">
                  <FileUp size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-ink">Opção de anexar foto</p>
                  <p className="text-[11px] text-muted leading-[1.5] mt-1">
                    Anexe fotos das produções ou registros da criança para compor o portfólio.
                  </p>
                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {attachments.map((item) => (
                        <div key={item.id} className="bg-cream rounded-app-sm px-3 py-2 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-[9px] bg-white flex items-center justify-center text-gm flex-shrink-0">
                            {item.isImage ? <Image size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-ink truncate">{item.name}</p>
                            <p className="text-[10px] text-muted">{formatFileSize(item.size)}</p>
                          </div>
                          <button
                            onClick={() => removeAttachment(item.id)}
                            className="w-7 h-7 rounded-full bg-white text-muted flex items-center justify-center flex-shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <label
                className={`relative block w-full mt-3 py-[11px] rounded-app-sm border-[1.5px] border-dashed border-border text-muted text-sm font-bold bg-white text-center overflow-hidden ${
                  uploadingAttachments ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={uploadingAttachments}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handlePortfolioInputChange}
                />
                <span aria-hidden="true">{uploadingAttachments ? 'Enviando...' : '+ Anexar foto'}</span>
              </label>
            </div>
            )}

            <button
              onClick={generate}
              disabled={!canGenerate || generating}
              className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <><Sparkles size={18} /> {isClassDiary ? 'Gerar diário' : 'Gerar documento'}</>
            </button>
            {!canGenerate && generationRequirementHint && (
              <p className="mt-3 rounded-app-sm border border-[#F1D58B] bg-[#FFF8DC] px-3 py-2 text-[12px] leading-[1.5] text-[#6B5300]">
                {generationRequirementHint}
              </p>
            )}
            {(usageError || usageMessage) && (
              <p className={`mt-3 rounded-app-sm border px-3 py-2 text-[12px] leading-[1.5] ${
                usageError ? 'border-red-200 bg-red-50 text-red-700' : 'border-gp bg-gbg text-gd'
              }`}>
                {usageError || usageMessage}
              </p>
            )}
            {usageError && (
              <button
                onClick={generate}
                className="mt-2 w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
              >
                Tentar novamente
              </button>
            )}
            {draftMessage && (
              <p className="mt-2 text-[12px] text-gm">{draftMessage}</p>
            )}
          </div>
          )
        ) : (
          <div className="py-4">
            {usageMessage && (
              <p className="mb-3 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] text-gd">
                {usageMessage}
              </p>
            )}
            <div className="bg-white rounded-app p-5 border border-border shadow-card mb-4">
              {generatedImageUrl && !editingDocument ? (
                <div className="flex flex-col gap-3">
                  <img
                    src={generatedImageUrl}
                    alt="Portfólio pedagógico gerado"
                    className="w-full rounded-app-sm border border-border bg-cream"
                  />
                  <p className="text-[11px] text-muted leading-[1.5]">
                    A imagem foi gerada com base nas anotações e orientações selecionadas. O prompt usado foi salvo no documento.
                  </p>
                </div>
              ) : editingDocument ? (
                <textarea
                  className="w-full min-h-[520px] resize-y bg-white rounded-app-sm border border-border px-5 py-5 text-[14px] text-ink outline-none leading-[1.8] font-serif shadow-inner"
                  value={editableContent}
                  onChange={(event) => setEditableContent(event.target.value)}
                />
              ) : (
                <div
                  className="document-editor text-[12px] text-ink leading-[1.7]"
                  dangerouslySetInnerHTML={{ __html: toDisplayHtml(editableContent || savedContent || mockReport) }}
                />
              )}
            </div>

            <button
              onClick={() => openSubscreen('generated-documents', {
                reportType: currentReportType === 'portfolio_image' ? undefined : currentReportType,
                kind: currentReportType === 'portfolio_image' ? 'images' : undefined,
                studentId: isClassDiary ? undefined : selectedStudent?.id,
                classId: isClassDiary ? selectedClass?.id : undefined,
                focusReportId: reportId,
              })}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2"
            >
              Histórico de gerados
            </button>

            <button
              onClick={() => reportId && openSubscreen('document-detail', { reportId })}
              disabled={!reportId}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2 disabled:opacity-60"
            >
              Visualizar como documento
            </button>

            {reportId && isSupabaseAuthEnabled() && currentReportType !== 'portfolio_image' && (
              <button
                onClick={() => openSubscreen('document-detail', { reportId, openCoordinatorShare: true })}
                className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2 flex items-center justify-center gap-2"
              >
                <KeyRound size={14} />
                Enviar para coordenadora
              </button>
            )}

            {editingDocument ? (
              <button
                onClick={saveDocument}
                disabled={savingDocument || editableContent === savedContent}
                className="w-full py-[13px] rounded-app-sm bg-gm text-white font-bold text-sm border-none mb-2 disabled:opacity-50"
              >
                {savingDocument ? 'Salvando...' : 'Salvar'}
              </button>
            ) : (
              <button
                onClick={() => setEditingDocument(true)}
                className="w-full py-[13px] rounded-app-sm bg-gm text-white font-bold text-sm border-none mb-2"
              >
                Editar
              </button>
            )}

            <button
              onClick={() => exportAbntDocument(editableContent || savedContent || mockReport, reportKind)}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2"
            >
              Exportar documento ABNT
            </button>

            <button onClick={archiveDocument} className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold mb-2">
              Arquivar
            </button>

            {!isClassDiary && !isParentsMeeting && selectedStudent?.id && (
              <button
                onClick={() => openSubscreen('generated-documents', { studentId: selectedStudent.id })}
                className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold mb-2"
              >
                Ver histórico desta criança
              </button>
            )}

            <button onClick={() => {
              if (editingDocument && editableContent !== savedContent) {
                const discard = window.confirm('Você tem alterações não salvas. Deseja descartar?')
                if (!discard) return
              }
              setGenerated(false)
            }} className="w-full py-[11px] border-none bg-transparent text-muted text-sm cursor-pointer">
              Gerar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingTextArea(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <>
      <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
        {props.label}
      </label>
      <textarea
        className="w-full min-h-[94px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] text-ink outline-none leading-[1.6]"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </>
  )
}

function SourceToggle(props: {
  selected: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={props.onClick}
      className={`w-full rounded-app-sm border px-3 py-3 text-left ${
        props.selected ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
      }`}
    >
      <span className="block text-[13px] font-bold">
        {props.selected ? '[x] ' : '[ ] '}
        {props.title}
      </span>
      <span className="block text-[11px] mt-1">{props.desc}</span>
    </button>
  )
}

function matchesStudent(annotation: Annotation, studentId: string, studentName?: string) {
  if (annotation.studentId && annotation.studentId === studentId) return true
  if (studentName && annotation.studentName === studentName) return true
  return false
}

function matchesClass(annotation: Annotation, classId?: string) {
  if (!classId) return false
  return annotation.classId === classId
}

function dedupeAnnotations(annotations: Annotation[]) {
  const seen = new Set<string>()
  return annotations.filter((annotation) => {
    if (seen.has(annotation.id)) return false
    seen.add(annotation.id)
    return true
  })
}

function getReportGenerationType(portfolioOutput: PortfólioOutput): AiGenerationType {
  return portfolioOutput === 'image' ? 'portfolio_image' : 'general_report'
}

function createReportPreview(input: {
  reportKind: string
  studentName: string
  className: string
  firstName: string
  mode: ReportMode
  selectedAnnotations: Annotation[]
  ignoredNotes: string
  blankContext: string
  extraContext: string
  attachments: ReportAttachment[]
  portfolioOutput: PortfólioOutput
  portfolioImageFormat: PortfolioImageFormat
  diaryDate: string
  diaryTheme: string
  diaryRawText: string
  finalConsiderations: string
  selectedMilestones: Annotation[]
  includeDayAnnotations: boolean
  meetingDate: string
  meetingDuration: string
  meetingAgenda: string
}) {
  const annotationBlock = input.selectedAnnotations.length
    ? input.selectedAnnotations.map((annotation) => `- ${annotation.date} | ${annotation.label}: ${annotation.text}`).join('\n')
    : 'Nenhuma anotação selecionada.'

  const sourceBlock = input.mode === 'blank'
    ? `RELATO INFORMADO PELA PROFESSORA\n\n${input.blankContext.trim() || '-'}`
    : `ANOTACOES SELECIONADAS\n\n${annotationBlock}\n\nDESCONSIDERAR\n\n${input.ignoredNotes.trim() || 'Nada informado para desconsiderar.'}`

  const header = `${input.reportKind.toUpperCase()}
Criança: ${input.studentName}
Turma: ${input.className}
Período: 2026

BASE UTILIZADA

${sourceBlock}

ORIENTAÇÁO ADICIONAL DA PROFESSORA

${input.extraContext.trim() || 'Nenhuma orientação adicional foi incluída antes da geração.'}`

  if (input.reportKind === 'Registro de reunião de pais' || input.reportKind === 'Planejamento de Reunião dos Pais') {
    return `PLANEJAMENTO DE REUNIÁO — ${input.className}
Data: ${input.meetingDate || '__ / __ / ____'}   Duração estimada: ${input.meetingDuration || '1h30'}

PAUTA DA REUNIÁO
${input.meetingAgenda.trim() || '1. [item da pauta] — tempo sugerido\n2. [item da pauta]\n3. [item da pauta]'}

OBSERVAÇÕES E ENCAMINHAMENTOS
${input.extraContext.trim() || 'Anotações e encaminhamentos definidos durante a reunião.'}

ESPAÇO PARA ANOTAÇÕES DURANTE A REUNIÁO
________________________________________
________________________________________
________________________________________

Documento gerado a partir das informações autorizadas pela professora.`
  }

  if (input.reportKind === 'Diário de bordo' || input.reportKind === 'Diário de Bordo') {
    return `${header}

DIÁRIO DE BORDO PEDAGÓGICO

Turma: ${input.className}
Data: ${input.diaryDate || 'Não informada'}
Tema do dia: ${input.diaryTheme || 'Não informado'}

Anotação original da professora:
${input.diaryRawText.trim() || '-'}

Puxar anotações: ${input.includeDayAnnotations ? 'sim' : 'não'}

Versão organizada:
A turma participou com envolvimento nas propostas do dia, com destaque para momentos de interação coletiva e exploração dos materiais apresentados. Ao longo da rotina, observou-se participação ativa em rodas, brincadeiras e combinados, favorecendo convivência, comunicação e autonomia.

O registro indica continuidade positiva do percurso pedagógico da turma, com oportunidades para retomar o tema em novas experiências e manter a documentação do cotidiano de forma leve e objetiva.${formatAttachments(input.attachments)}

Documento gerado a partir das informações autorizadas pela professora.`
  }

  if (input.reportKind === 'Portfólio pedagógico' || input.reportKind === 'Portfólio') {
    const milestones = input.selectedMilestones.length
      ? input.selectedMilestones.map((annotation) => `- ${annotation.date} | ${annotation.label}: ${annotation.text}`).join('\n')
      : '- Nenhum marco selecionado.'
    if (input.portfolioOutput === 'image') {
      return `${header}

PORTFÓLIO VISUAL COM CHATGPT

MARCOS IMPORTANTES
${milestones}

Objetivo da imagem:
Gerar uma capa ou painel visual para o relatório de desenvolvimento de ${input.firstName}, usando apenas informações reais, anotações e anexos autorizados pela professora.

Direção visual:
- composição clara, delicada e apropriada para educação infantil;
- espaços para título, nome da criança, turma e período;
- blocos visuais para adaptação e convivência, linguagem, movimento/autonomia, interesses, família e considerações finais;
- não expor outras crianças;
- não separar por campos de experiência;
- não inventar informações sobre a criança;
- usar fotos e documentos anexados apenas como referência autorizada.

Prompt base para imagem:
"Criar uma capa ou painel visual de relatório de desenvolvimento infantil para ${input.firstName}, turma ${input.className}, em formato ${formatPortfolioImageFormat(input.portfolioImageFormat)}, com estética acolhedora, organizada e profissional para educação infantil. Usar apenas evidências reais informadas pela professora. Incluir blocos curtos sobre adaptação e convivência, linguagem, movimento e autonomia, interesses, família e considerações finais. Não separar por campos de experiência. Evitar texto pequeno ilegível e não expor outras crianças."

Observação:
Quando a geração de imagem estiver disponível, esta opção criará a imagem do portfólio com base no contexto informado.${formatAttachments(input.attachments)}

Imagem preparada a partir das informações autorizadas pela professora.`
    }

    return `${header}

PORTFÓLIO PEDAGÓGICO

MARCOS IMPORTANTES
${milestones}

Apresentação:
Este portfólio organiza evidências da jornada de ${input.firstName} na educação infantil, reunindo registros de experiências, produções, falas, brincadeiras e momentos significativos.

Evidências selecionadas:
- registros de atividades e explorações;
- observações da rotina;
- conquistas de autonomia;
- interações sociais;
- fotos ou documentos anexados pela professora, quando autorizados.

Leitura pedagógica:
As evidências mostram como ${input.firstName} explora o ambiente, constrói vínculos, expressa ideias, participa das propostas e amplia suas possibilidades de comunicação, movimento e convivência.

Memória afetiva:
Mais do que reunir atividades prontas, este portfólio guarda marcas do percurso vivido pela criança, respeitando seu tempo, seus interesses e suas formas de aprender.

Continuidade:
Novas evidências podem ser adicionadas ao longo do período para formar uma memória pedagógica viva e segura.${formatAttachments(input.attachments)}

Documento gerado a partir das informações autorizadas pela professora.`
  }

  if (isSpecialistReport(input.reportKind) || input.reportKind === 'Rel. Atipico') {
    const specialistSections = getSpecialistSections(input.reportKind)
    return `${header}

RELATÓRIO PEDAGÓGICO PARA ESPECIALISTA

Observação de cuidado:
Este texto organiza observações pedagógicas e não realiza diagnóstico clínico. O foco é acolher ${input.firstName}, registrar fatos observados na escola e apoiar a continuidade do acompanhamento com a família, equipe escolar e profissionais especializados.

Objetivo do documento:
${specialistSections.objective}

Eixos de observação:
${specialistSections.axes.map((axis) => `- ${axis}`).join('\n')}

Potencialidades e respostas positivas:
- interesses, iniciativas e momentos de participação;
- vínculos construídos com adultos e colegas;
- estrategias que favoreceram segurança, comunicação ou organização;
- situações em que a criança demonstrou curiosidade, autonomia ou bem-estar.

Pontos de apoio observados:
- situações que exigem mediação mais próxima;
- contextos de maior desafio na rotina;
- recursos, adaptações ou antecipacoes que podem ajudar;
- parceria necessária entre escola, família e especialista.

Encaminhamentos:
Manter registros frequentes, compartilhar apenas informações autorizadas e alinhar os próximos passos com coordenação, família e profissional responsável.${formatAttachments(input.attachments)}

Documento gerado a partir das informações autorizadas pela professora.`
  }

  return `${header}

RELATÓRIO DE DESENVOLVIMENTO

Informações básicas:
Criança: ${input.studentName}
Turma: ${input.className}
Período: 2026

Adaptação e convivência:
Esta seção deve ser escrita somente com base nas anotações, observações e informações reais fornecidas pela professora. Se não houver registro suficiente, a IA deve informar que não há evidência suficiente para afirmar esse ponto.

Desenvolvimento da linguagem:
Registrar fala, escuta, comunicação, interação verbal ou outras formas de expressão apenas quando houver evidências informadas.

Desenvolvimento motor:
Registrar movimento, coordenação, participação corporal, exploração de materiais e brincadeiras apenas com base nos registros reais.

Desenvolvimento cognitivo e autonomia:
Registrar curiosidade, resolução de situações, atenção, participação, escolhas, cuidados pessoais e autonomia na rotina apenas quando houver dados fornecidos.

Interesses e preferências:
Descrever brincadeiras, temas, materiais, atividades ou vínculos de interesse apenas se a professora tiver informado.

Participação da família:
Incluir apenas informações reais sobre família, parceria ou continuidade casa-escola. Não inventar participação familiar.

Considerações finais:
${input.finalConsiderations.trim() || 'Fechar com síntese cuidadosa do que foi observado e próximos acompanhamentos possíveis, sem criar fatos novos.'}${formatAttachments(input.attachments)}

Documento gerado a partir das informações autorizadas pela professora.`
}

function formatAttachments(attachments: ReportAttachment[]) {
  if (!attachments.length) return ''
  return `\n\nANEXOS CONSIDERADOS\n\n${attachments.map((item) => `- ${item.name} (${formatFileSize(item.size)})`).join('\n')}`
}

function appendPortfolioImagesToBody(body: string, attachments: ReportAttachment[], studentName: string) {
  const images = attachments.filter((item) => item.isImage && item.dataUrl)
  if (!images.length) return body

  const imageHtml = images
    .map((image, index) => `
      <figure class="portfolio-child-image">
        <img src="${image.dataUrl}" alt="${escapeHtml(`Registro de portfólio de ${studentName}`)}" />
        <figcaption>${escapeHtml(index === 0 ? `Registro visual de ${studentName}` : image.name)}</figcaption>
      </figure>
    `)
    .join('')

  return `
    <section class="portfolio-document">
      <div class="portfolio-images">${imageHtml}</div>
      <div class="portfolio-text">${textToHtml(body)}</div>
    </section>
  `.trim()
}

function toDisplayHtml(value: string) {
  const normalized = normalizeReportBodyHtml(value)
  if (normalized) return normalized
  if (isHtmlContent(value)) return value.trim()
  return textToHtml(value)
}

function textToHtml(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function isHtmlContent(value: string) {
  return /<[a-z][\s\S]*>/i.test(value.trim())
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Não foi possível preparar a imagem para o portfólio.'))
    reader.readAsDataURL(file)
  })
}

function isSpecialistReport(reportKind: string) {
  return [
    'Relatório para neuropediatra',
    'Relatório para psiquiatra infantil',
    'Relatório para fonoaudiologo',
    'Relatório para terapeuta ocupacional',
    'Relatório para psicologo',
    'Relatório para psicopedagogo',
    'Encaminhamento para especialista',
  ].includes(reportKind)
}

function getSpecialistSections(reportKind: string) {
  if (reportKind === 'Relatório para fonoaudiologo') {
    return {
      objective: 'Descrever fala, linguagem, compreensao e interacao comunicativa observadas no cotidiano escolar.',
      axes: [
        'desenvolvimento da fala, articulacao, fluencia, vocabulario e formacao de frases',
        'compreensao de instrucoes, historias, objetos, pessoas e combinados',
        'interacao comunicativa com colegas e adultos',
        'uso da voz, volume, entonacao e intencao comunicativa',
      ],
    }
  }

  if (reportKind === 'Relatório para terapeuta ocupacional') {
    return {
      objective: 'Descrever aspectos sensoriais, motores e de autonomia que interferem na participação da criança nas atividades diarias.',
      axes: [
        'processamento sensorial diante de ruidos, texturas, luz, cheiros e movimentos',
        'habilidades motoras finas, preensao, manipulacao e uso de materiais',
        'habilidades motoras grossas, equilibrio, coordenacao e brincadeiras corporais',
        'autonomia em alimentacao, higiene, vestuario e organizacao pessoal',
      ],
    }
  }

  if (reportKind === 'Relatório para psicologo') {
    return {
      objective: 'Descrever aspectos emocionais, sociais e comportamentais observados na rotina escolar.',
      axes: [
        'regulacao emocional diante de alegria, tristeza, frustracao e espera',
        'interacao social com colegas e adultos',
        'participação em atividades coletivas, cooperacao e combinados',
        'mudancas de humor, isolamento, medos ou preocupacoes observadas',
      ],
    }
  }

  if (reportKind === 'Relatório para psicopedagogo') {
    return {
      objective: 'Descrever processos de aprendizagem, engajamento e estrategias que favorecem a participação da criança.',
      axes: [
        'formas de aprender: visual, auditiva, corporal, prática ou por imitacao',
        'atenção, memoria, raciocinio logico e resolucao de problemas',
        'motivacao e engajamento nas propostas pedagógicas',
        'estrategias pedagógicas que funcionam melhor para a criança',
      ],
    }
  }

  if (reportKind === 'Encaminhamento para especialista') {
    return {
      objective: 'Registrar de forma concisa as observações que justificam uma avaliação externa, sem concluir diagnóstico.',
      axes: [
        'motivo do encaminhamento e situacoes observadas',
        'frequencia, contexto e impacto na rotina escolar',
        'estrategias já tentadas pela escola',
        'solicitação de avaliação e orientacoes para continuidade do acompanhamento',
      ],
    }
  }

  return {
    objective: 'Descrever observações pedagógicas sobre comunicação, socialização, comportamento, aspectos sensoriais, autonomia, psicomotricidade e aprendizagem.',
    axes: [
      'linguagem e comunicacao: gestos, contato visual, fala, vocabulario e compreensao',
      'habilidades sociais: interacao com pares e adultos, imitacao e brincadeiras coletivas',
      'comportamento: rotina, frustracoes, interesses, repeticoes, passividade ou agressividade',
      'aspectos sensoriais: sons, texturas, cheiros, luz e movimentos',
      'sono, alimentacao, higiene, vestuario e outras habilidades adaptativas',
      'aspectos psicomotores e cognitivos: coordenacao, atenção, memoria e resolucao de problemas',
    ],
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(apng|avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

async function extractAttachmentText(file: File) {
  if (!isTextAttachment(file)) return undefined
  if (file.size > 220_000) return undefined
  try {
    const text = await file.text()
    const clean = text.replace(/\s+/g, ' ').trim()
    return clean ? clean.slice(0, 6000) : undefined
  } catch {
    return undefined
  }
}

function isTextAttachment(file: File) {
  const type = file.type.toLowerCase()
  if (type.startsWith('text/')) return true
  return /\.(txt|md|csv|json|rtf)$/i.test(file.name)
}

function mergeLivingReport(existingBody: string, updateBlock: string) {
  const today = new Date().toLocaleDateString('pt-BR')
  const normalizedExisting = existingBody.trim()
  const normalizedUpdate = updateBlock.trim()
  if (!normalizedExisting) return normalizedUpdate
  return `${normalizedExisting}\n\nATUALIZACAO CONTINUA (${today})\n\n${normalizedUpdate}`
}

function summarizeVoiceAnnotations(annotations: Annotation[]) {
  const items = annotations
    .slice(0, 4)
    .map((annotation) => `- ${annotation.date}: ${annotation.text.slice(0, 120)}`)
  return `Resumo de anotações por voz:\n${items.join('\n')}`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function exportAbntDocument(content: string, title: string) {
  const filename = normalize(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'documento'
  const paragraphs = toDisplayHtml(content)
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
    body { color: #000; font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
    h1 { font-size: 14pt; text-align: center; text-transform: uppercase; margin: 0 0 24pt; }
    p { margin: 0 0 12pt; }
    .portfolio-images { margin: 0 0 18pt; text-align: center; }
    .portfolio-child-image { margin: 0 auto 14pt; page-break-inside: avoid; text-align: center; }
    .portfolio-child-image img { max-width: 11cm; max-height: 9cm; object-fit: contain; border: 1px solid #ddd; }
    .portfolio-child-image figcaption { font-size: 10pt; color: #555; margin-top: 4pt; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${paragraphs}
</body>
</html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.doc`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char] ?? char
  })
}

function formatPortfolioImageFormat(value: PortfolioImageFormat) {
  if (value === 'landscape') return 'paisagem A4'
  if (value === 'square') return 'quadrado'
  return 'retrato A4'
}

function resolveDocumentLoadingVariant(reportKind: string) {
  if (reportKind === 'Diário de bordo' || reportKind === 'Diário de Bordo') return 'diary'
  if (reportKind.toLowerCase().includes('planejamento') || reportKind.toLowerCase().includes('plano')) return 'planning'
  if (reportKind.toLowerCase().includes('interven')) return 'intervention'
  if (reportKind.toLowerCase().includes('relat')) return 'report'
  return 'default'
}

function getGenerationRequirementHint(input: {
  isUnifiedCreator?: boolean
  documentTitleLength?: number
  useUnifiedAnnotations?: boolean
  unifiedAnnotationsCount?: number
  extraContextLength: number
}) {
  if (input.isUnifiedCreator) {
    if ((input.documentTitleLength ?? 0) < 3) {
      return 'Informe um título com pelo menos 3 caracteres.'
    }
    if (input.extraContextLength < 10) {
      return 'Descreva o que você quer criar com pelo menos 10 caracteres.'
    }
    if (input.useUnifiedAnnotations && (input.unifiedAnnotationsCount ?? 0) === 0) {
      return 'Selecione anotações ou desative a opção de usar anotações.'
    }
    return ''
  }
  return ''
}

function resizeImageForPortfolio(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const MAX_DIM = 1024
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIM)
          width = MAX_DIM
        } else {
          width = Math.round((width / height) * MAX_DIM)
          height = MAX_DIM
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
