import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, FileText, FileUp, Image, Sparkles, X } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { formatAiUsageMessage, generateAiPortfolioImage, generateAiTextDocument, type AiGenerationType } from '@/services/ai-usage'
import { listReports, updateReport } from '@/services/reports'
import { celebrateAiGeneration } from '@/utils/celebration'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import { loadDocumentStyleSettings } from '@/utils/document-style'
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
}

type ReportMode = 'annotations' | 'blank'
type PortfólioOutput = 'text' | 'image'
type PortfolioImageFormat = 'portrait' | 'landscape' | 'square'

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

  const reportKind = typeof data === 'object' && data && 'reportKind' in data
    ? String((data as { reportKind?: string }).reportKind)
    : 'Relatório de desenvolvimento'
  const assistantMode = typeof data === 'object' && data && 'assistantMode' in data
    ? String((data as { assistantMode?: string }).assistantMode)
    : ''
  const isPortfólio = reportKind === 'Portfólio pedagógico' || reportKind === 'Portfólio'
  const isDevelopmentReport = reportKind === 'Relatório de desenvolvimento' || reportKind === 'Relatório de Desenvolvimento'
  const isClassDiary = reportKind === 'Diário de bordo' || reportKind === 'Diário de Bordo'
  const isParentsMeeting = reportKind === 'Registro de reunião de pais' || reportKind === 'Planejamento de Reunião dos Pais'
  const isPlanning = isPlanningKind(reportKind) && !isParentsMeeting

  const [mode, setMode] = useState<ReportMode>('annotations')
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [ignoredNotes, setIgnoredNotes] = useState('')
  const [blankContext, setBlankContext] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [attachments, setAttachments] = useState<ReportAttachment[]>([])
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
  const [meetingOpening, setMeetingOpening] = useState('')
  const [meetingAgenda, setMeetingAgenda] = useState('')
  const [meetingGeneralInfo, setMeetingGeneralInfo] = useState('')
  const [meetingAgreements, setMeetingAgreements] = useState('')
  const [meetingClosing, setMeetingClosing] = useState('')
  const [livingReport, setLivingReport] = useState(false)
  const [latestReportId, setLatestReportId] = useState('')
  const [latestReportBody, setLatestReportBody] = useState('')
  const [loadingLatest, setLoadingLatest] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftKeyRef = useRef('')
  const loadedDraftRef = useRef(false)

  const studentAnnotations = useMemo(() => {
    if (isClassDiary || isParentsMeeting || isPlanning) {
      return annotations.filter((annotation) => matchesClass(annotation, selectedClass?.id) && !annotation.studentId)
    }
    return annotations.filter((annotation) => matchesStudent(annotation, selectedStudentId, selectedStudent?.name))
  }, [annotations, isClassDiary, isParentsMeeting, isPlanning, selectedClass?.id, selectedStudentId, selectedStudent?.name])
  const selectedAnnotations = studentAnnotations.filter((annotation) => selectedAnnotationIds.includes(annotation.id))
  const milestoneAnnotations = useMemo(() => {
    const filtered = studentAnnotations.filter((annotation) => {
      const text = normalize(`${annotation.label} ${annotation.text}`)
      return text.includes('marco') || text.includes('evolucao') || text.includes('portfolio') || text.includes('conquista')
    })
    return filtered.length ? filtered : studentAnnotations
  }, [studentAnnotations])
  const selectedMilestones = milestoneAnnotations.filter((annotation) => selectedMilestoneIds.includes(annotation.id))
  const firstName = selectedStudent?.name.split(' ')[0] ?? 'A criança'
  const supportsLivingReport = isDevelopmentReport
  const needsBnccFields = isPlanning
  const needsAgeGroup = isPlanning
  const needsObjective = isPlanning
  const needsEvaluationPeriod = isDevelopmentReport
  const currentReportType = getReportGenerationType(reportKind, portfolioOutput)
  const isSpecialistReferral = currentReportType === 'specialist_referral' || currentReportType === 'specialist_report'
  const hasContentBase = isClassDiary
    ? diaryRawText.trim().length >= 20
    : isPortfólio
      ? selectedMilestones.length > 0 || extraContext.trim().length >= 10 || attachments.length > 0
    : isParentsMeeting
      ? meetingAgenda.trim().length >= 10
    : mode === 'blank'
      ? blankContext.trim().length >= 20
      : selectedAnnotations.length > 0 || extraContext.trim().length >= 20
  const hasRequiredBnccInput = !needsBnccFields || ((!needsAgeGroup || ageGroup.trim().length > 0) && bnccFields.length > 0)
  const hasRequiredObjective = !needsObjective || objective.trim().length >= 10
  const hasRequiredPeriod = !needsEvaluationPeriod || evaluationPeriod.trim().length >= 5
  const hasRequiredDevelopmentFields = !isDevelopmentReport || finalConsiderations.trim().length >= 10
  const hasRequiredMeetingFields = !isParentsMeeting
    || Boolean(meetingDate && meetingDuration && meetingOpening.trim().length >= 10 && meetingAgenda.trim().length >= 10 && meetingGeneralInfo.trim().length >= 10 && meetingAgreements.trim().length >= 10 && meetingClosing.trim().length >= 10)
  const canGenerate = hasContentBase && hasRequiredBnccInput && hasRequiredObjective && hasRequiredPeriod && hasRequiredDevelopmentFields && hasRequiredMeetingFields
  const generationRequirementHint = getGenerationRequirementHint({
    isClassDiary,
    isSpecialistReferral,
    isParentsMeeting,
    mode,
    selectedAnnotationsCount: selectedAnnotations.length,
    extraContextLength: extraContext.trim().length,
    blankContextLength: blankContext.trim().length,
    diaryRawLength: diaryRawText.trim().length,
    hasRequiredBnccInput,
    hasRequiredObjective,
    hasRequiredPeriod,
    hasRequiredDevelopmentFields,
    hasRequiredMeetingFields,
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
      meetingOpening: string
      meetingAgenda: string
      meetingGeneralInfo: string
      meetingAgreements: string
      meetingClosing: string
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
      setMeetingOpening(draft.meetingOpening || '')
      setMeetingAgenda(draft.meetingAgenda || '')
      setMeetingGeneralInfo(draft.meetingGeneralInfo || '')
      setMeetingAgreements(draft.meetingAgreements || '')
      setMeetingClosing(draft.meetingClosing || '')
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
        meetingOpening,
        meetingAgenda,
        meetingGeneralInfo,
        meetingAgreements,
        meetingClosing,
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
    meetingAgreements,
    meetingClosing,
    meetingDate,
    meetingDuration,
    meetingGeneralInfo,
    meetingOpening,
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
    meetingOpening,
    meetingAgenda,
    meetingGeneralInfo,
    meetingAgreements,
    meetingClosing,
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

  function handleFiles(files: FileList | null) {
    if (!files?.length) return

    const selected = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      isImage: file.type.startsWith('image/'),
    }))

    setAttachments((current) => {
      const existing = new Set(current.map((item) => item.id))
      return [...current, ...selected.filter((item) => !existing.has(item.id))]
    })
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
    setMeetingOpening('')
    setMeetingAgenda('')
    setMeetingGeneralInfo('')
    setMeetingAgreements('')
    setMeetingClosing('')
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

    try {
      const styleSettings = loadDocumentStyleSettings()
      const requestSummary = {
        reportKind,
        portfolioOutput,
        portfolioImageFormat,
        historyScope,
        mode,
        studentName: isClassDiary || isParentsMeeting ? null : (selectedStudent?.name ?? null),
        className: isClassDiary || isParentsMeeting ? (selectedClass?.name ?? null) : (selectedStudent?.className ?? null),
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
        meetingOpening: isParentsMeeting ? meetingOpening : null,
        meetingAgenda: isParentsMeeting ? meetingAgenda : null,
        meetingGeneralInfo: isParentsMeeting ? meetingGeneralInfo : null,
        meetingAgreements: isParentsMeeting ? meetingAgreements : null,
        meetingClosing: isParentsMeeting ? meetingClosing : null,
        assistantMode: assistantMode || null,
        livingReport,
        voiceAnnotationsCount: voiceAnnotations.length,
        selectedAnnotations: selectedAnnotations.map((annotation) => ({
          date: annotation.date,
          label: annotation.label,
          text: annotation.text,
        })),
        ignoredNotes,
        blankContext,
        extraContext: extraContext.trim(),
        attachments: attachments.map((item) => ({
          name: item.name,
          type: item.type,
          size: item.size,
        })),
        documentStyle: styleSettings,
      }

      const generationType = getReportGenerationType(reportKind, portfolioOutput)
      const result = generationType === 'portfolio_image'
        ? await generateAiPortfolioImage({
            generationType,
            classId: isClassDiary || isParentsMeeting ? (selectedClass?.id ?? null) : (selectedStudent?.classId ?? null),
            studentId: isClassDiary || isParentsMeeting ? null : (selectedStudent?.id ?? null),
            promptVersion: 'portfolio-image-v1',
            requestSummary,
          })
        : await generateAiTextDocument({
            generationType,
            classId: isClassDiary || isParentsMeeting ? (selectedClass?.id ?? null) : (selectedStudent?.classId ?? null),
            studentId: isClassDiary || isParentsMeeting ? null : (selectedStudent?.id ?? null),
            promptVersion: 'professora-report-v1',
            requestSummary,
          })

      if (!result.allowed) {
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
      let nextBody = generatedBody
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
        celebrateAiGeneration()
        setGenerating(false)
        setGenerated(true)
      }, 900)
      if (draftKeyRef.current) {
        clearDraft(draftKeyRef.current)
      }
      resetReportFormAfterGeneration()
    } catch (error) {
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
        <span className="font-serif text-[18px] text-gd flex-1">{reportKind}</span>
      </div>

      <div key={generationViewKey} className="scroll-area px-[18px] stage-fade-in">
        {!generated ? (
          generating ? (
            currentReportType === 'portfolio_image'
              ? <GenerationImageLoadingScreen />
              : <GenerationDocumentLoadingScreen variant={resolveDocumentLoadingVariant(reportKind)} />
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
                    {isClassDiary
                      ? 'Preencha rapidamente os dados do dia da turma para gerar o diário.'
                      : isParentsMeeting
                      ? 'Selecione a turma e descreva a pauta para planejar a reunião.'
                      : 'Escolhá a criança. Orientações extras e anexos são opcionais.'}
                  </p>
                </div>
              </div>

              {isClassDiary || isParentsMeeting ? (
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

            {isDevelopmentReport && (
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

            {isParentsMeeting && (
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
                  label="Abertura (10 min)"
                  value={meetingOpening}
                  onChange={setMeetingOpening}
                  placeholder="Como receber os pais e criar um ambiente acolhedor no início da reunião."
                />
                <MeetingTextArea
                  label="Pauta da reunião"
                  value={meetingAgenda}
                  onChange={setMeetingAgenda}
                  placeholder="Liste os itens da pauta e, se quiser, o tempo sugerido para cada um."
                />
                <MeetingTextArea
                  label="Informações gerais da turma"
                  value={meetingGeneralInfo}
                  onChange={setMeetingGeneralInfo}
                  placeholder="Baseado nas suas anotações: como a turma está coletivamente, conquistas do período e próximos passos. Não cite nomes de crianças."
                />
                <MeetingTextArea
                  label="Combinados gerais"
                  value={meetingAgreements}
                  onChange={setMeetingAgreements}
                  placeholder="Sugestões de rotina e parceria com as famílias."
                />
                <div className="rounded-app-sm border border-dashed border-border bg-cream px-3 py-3 mb-4">
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Espaço para anotações durante a reunião</p>
                  <p className="text-[12px] text-muted mt-1">O documento gerado terá um campo em branco para a professora usar na hora.</p>
                </div>
                <MeetingTextArea
                  label="Encerramento (5 min)"
                  value={meetingClosing}
                  onChange={setMeetingClosing}
                  placeholder="Como fechar a reunião, agradecer a presença e reforçar a parceria com as famílias."
                />
              </div>
            )}

            {!isClassDiary && !isParentsMeeting && (needsBnccFields || needsObjective || needsEvaluationPeriod) && (
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

            {isDevelopmentReport && (
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

            {!isClassDiary && !isParentsMeeting && !isPortfólio && (
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
                        { id: 'portrait', label: 'Retrato', preview: '▮' },
                        { id: 'landscape', label: 'Paisagem', preview: '▬' },
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

            {isPortfólio && (
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

            {!isClassDiary && !isParentsMeeting && !isPortfólio && !isDevelopmentReport && (
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

            {isPortfólio && (
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

            {!isClassDiary && !isParentsMeeting && !isPortfólio && (mode === 'annotations' ? (
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

            {isClassDiary && (
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

            {!isParentsMeeting && (
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                {isPortfólio ? 'Campo de observação' : 'Orientação adicional'}
              </label>
              <textarea
                className="w-full min-h-[118px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                placeholder={isPortfólio
                  ? 'Algo que você queira acrescentar sobre o desenvolvimento desta criança ou sobre as fotos anexadas.'
                  : 'Ex.: destacar a adaptação nas últimas semanas, evitar linguagem muito técnica e incluir encaminhamentos para a família...'}
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
              />
            </div>
            )}

            {isPortfólio && (
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-3 py-[11px] rounded-app-sm border-[1.5px] border-dashed border-border text-muted text-sm font-bold bg-white"
              >
                + Anexar foto
              </button>
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
                <pre className="whitespace-pre-wrap font-sans text-[12px] text-ink leading-[1.7]">{editableContent || savedContent || mockReport}</pre>
              )}
            </div>

            <button
              onClick={() => openSubscreen('generated-documents', {
                reportType: currentReportType,
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

function matchesStudent(annotation: Annotation, studentId: string, studentName?: string) {
  if (annotation.studentId && annotation.studentId === studentId) return true
  if (studentName && annotation.studentName === studentName) return true
  return false
}

function matchesClass(annotation: Annotation, classId?: string) {
  if (!classId) return false
  return annotation.classId === classId
}

function getReportGenerationType(reportKind: string, portfolioOutput: PortfólioOutput): AiGenerationType {
  if (reportKind === 'Relatório de desenvolvimento' || reportKind === 'Relatório de Desenvolvimento') return 'development_report'
  if (reportKind === 'Diário de bordo' || reportKind === 'Diário de Bordo') return 'class_diary'
  if (reportKind === 'Planejamento semanal') return 'weekly_planning'
  if (reportKind === 'Plano de aula diário') return 'daily_lesson_plan'
  if (reportKind === 'Projeto pedagógico específico' || reportKind === 'Projeto Pedagógico') return 'pedagógical_project'
  if (reportKind === 'Registro de reunião de pais' || reportKind === 'Planejamento de Reunião dos Pais') return 'parents_meeting_record'
  if (reportKind === 'Portfólio pedagógico' || reportKind === 'Portfólio') {
    return portfolioOutput === 'image' ? 'portfolio_image' : 'portfolio_text'
  }
  if (isSpecialistReport(reportKind) || reportKind === 'Rel. Atipico') return 'specialist_referral'
  return 'general_report'
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
  meetingOpening: string
  meetingAgenda: string
  meetingGeneralInfo: string
  meetingAgreements: string
  meetingClosing: string
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

ABERTURA (10 min)
${input.meetingOpening.trim() || 'Como receber os pais e criar ambiente acolhedor.'}

PAUTA DA REUNIÁO
${input.meetingAgenda.trim() || '1. [item da pauta] — tempo sugerido'}

INFORMAÇÕES GERAIS DA TURMA
${input.meetingGeneralInfo.trim() || 'Baseado nas suas anotações: como a turma está coletivamente, conquistas do período e próximos passos.'}

COMBINADOS GERAIS
${input.meetingAgreements.trim() || 'Sugestões de rotina e parceria com as famílias.'}

ESPAÇO PARA ANOTAÇÕES DURANTE A REUNIÁO
________________________________________
________________________________________
________________________________________

ENCERRAMENTO (5 min)
${input.meetingClosing.trim() || 'Como fechar a reunião.'}

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

function isPlanningKind(reportKind: string) {
  const normalized = reportKind
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return normalized.includes('planejamento')
    || normalized.includes('plano de aula')
    || normalized.includes('projeto pedagógico')
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
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
    body { color: #000; font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
    h1 { font-size: 14pt; text-align: center; text-transform: uppercase; margin: 0 0 24pt; }
    p { margin: 0 0 12pt; }
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
  if (value === 'landscape') return 'paisagem'
  if (value === 'square') return 'quadrado'
  return 'retrato'
}

function resolveDocumentLoadingVariant(reportKind: string) {
  if (reportKind === 'Diário de bordo' || reportKind === 'Diário de Bordo') return 'diary'
  if (reportKind.toLowerCase().includes('planejamento') || reportKind.toLowerCase().includes('plano')) return 'planning'
  if (reportKind.toLowerCase().includes('interven')) return 'intervention'
  if (reportKind.toLowerCase().includes('relat')) return 'report'
  return 'default'
}

function getGenerationRequirementHint(input: {
  isClassDiary: boolean
  isSpecialistReferral: boolean
  isParentsMeeting: boolean
  mode: ReportMode
  selectedAnnotationsCount: number
  extraContextLength: number
  blankContextLength: number
  diaryRawLength: number
  hasRequiredBnccInput: boolean
  hasRequiredObjective: boolean
  hasRequiredPeriod: boolean
  hasRequiredDevelopmentFields: boolean
  hasRequiredMeetingFields: boolean
}) {
  if (input.isClassDiary && input.diaryRawLength < 20) {
    return 'Escreva um relato breve do dia da turma para criar um diário mais fiel.'
  }
  if (input.isParentsMeeting && !input.hasRequiredMeetingFields) {
    return 'Preencha abertura, pauta, informações gerais, combinados e encerramento da reunião.'
  }
  if (input.mode === 'blank' && input.blankContextLength < 20 && !input.isParentsMeeting) {
    return input.isSpecialistReferral
      ? 'Descreva o motivo do encaminhamento e os comportamentos observados na rotina.'
      : input.isParentsMeeting
        ? 'Descreva a pauta, observações, combinados ou encaminhamentos da reunião.'
        : 'Descreva melhor o contexto antes de gerar o documento.'
  }
  if (input.mode === 'annotations' && input.selectedAnnotationsCount === 0 && input.extraContextLength < 20) {
    return 'Selecione pelo menos uma anotação ou escreva uma orientação adicional com o contexto principal.'
  }
  if (!input.hasRequiredPeriod) return 'Informe o período de avaliação para contextualizar o relatório.'
  if (!input.hasRequiredDevelopmentFields) return 'Escreva as considerações finais do relatório.'
  if (!input.hasRequiredBnccInput) return 'Complete os campos pedagógicos obrigatórios antes de gerar.'
  if (!input.hasRequiredObjective) return 'Informe o objetivo pedagógico com um pouco mais de detalhe.'
  return ''
}
