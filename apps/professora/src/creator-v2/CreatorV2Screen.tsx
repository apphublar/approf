import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, CircleAlert, Sparkles, Wand2 } from 'lucide-react'
import type {
  CreatorDocumentType,
  CreatorImageFormat,
  CreatorMode,
  CreatorPayload,
  CreatorSourceMode,
  CreatorTone,
  CreatorVisualStyle,
} from './types'
import { useAppStore, useNavStore } from '@/store'
import type { Annotation } from '@/types'
import { celebrateAiGeneration } from '@/utils/celebration'
import { normalizeReportBodyHtml } from '@/utils/report-body'
import GenerationDocumentLoadingScreen from '@/components/ui/GenerationDocumentLoadingScreen'
import GenerationImageLoadingScreen from '@/components/ui/GenerationImageLoadingScreen'
import { formatAiUsageMessage, generateAiPortfolioImage, generateImage } from '@/services/ai-usage'
import { generateCreatorDocument, improveCreatorPrompt } from './api'
import {
  CREATOR_MODES,
  defaultDocumentTypeForMode,
  GUIDED_TYPES,
  guidedTypeUsesAnnotations,
  IMAGE_FORMATS,
  outputFormatForFreeChoice,
  RECOMMENDED_PROMPTS,
  SOURCE_MODES,
  TONE_OPTIONS,
  VISUAL_STYLES,
  VISUAL_TYPES,
} from './constants'

interface CreatorV2ScreenProps {
  data?: unknown
}

type FreeOutputChoice = 'text' | 'image'

function parseNavData(data: unknown) {
  if (!data || typeof data !== 'object') return {}
  return data as Record<string, unknown>
}

function matchesStudent(annotation: Annotation, studentId?: string, studentName?: string) {
  if (studentId && annotation.studentId === studentId) return true
  if (studentName && annotation.studentName === studentName) return true
  return false
}

function matchesClass(annotation: Annotation, classId?: string) {
  if (!classId) return false
  return annotation.classId === classId && !annotation.studentId
}

export default function CreatorV2Screen({ data }: CreatorV2ScreenProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, annotations, activeStudentId } = useAppStore()
  const nav = parseNavData(data)
  const generatingRef = useRef(false)

  const allStudents = useMemo(
    () => classes.flatMap((cls) => cls.students.map((student) => ({ ...student, classId: cls.id, className: cls.name }))),
    [classes],
  )

  const initialStudentId = typeof nav.studentId === 'string' ? nav.studentId : activeStudentId ?? allStudents[0]?.id ?? ''
  const initialClassId = typeof nav.classId === 'string' ? nav.classId : classes.find((cls) => cls.students.some((s) => s.id === initialStudentId))?.id ?? classes[0]?.id ?? ''

  const [mode, setMode] = useState<CreatorMode>(
    nav.mode === 'guided' || nav.mode === 'visual_portfolio' || nav.mode === 'free' ? nav.mode : 'guided',
  )
  const [documentType, setDocumentType] = useState<CreatorDocumentType>(() => {
    if (typeof nav.documentType === 'string') return nav.documentType as CreatorDocumentType
    return defaultDocumentTypeForMode(mode)
  })
  const [sourceMode, setSourceMode] = useState<CreatorSourceMode>(
    nav.sourceMode === 'student_notes' || nav.sourceMode === 'class_notes' || nav.sourceMode === 'notes_and_prompt' || nav.sourceMode === 'prompt_only'
      ? nav.sourceMode
      : nav.studentId ? 'student_notes' : 'prompt_only',
  )
  const [selectedClassId, setSelectedClassId] = useState(initialClassId)
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const [title, setTitle] = useState(typeof nav.title === 'string' ? nav.title : '')
  const [otherDocumentTitle, setOtherDocumentTitle] = useState('')
  const [teacherPrompt, setTeacherPrompt] = useState('')
  const [tone, setTone] = useState<CreatorTone | null>(null)
  const [visualStyle, setVisualStyle] = useState<CreatorVisualStyle | null>(null)
  const [imageFormat, setImageFormat] = useState<CreatorImageFormat>('portrait')
  const [freeOutput, setFreeOutput] = useState<FreeOutputChoice>(nav.freeOutput === 'image' ? 'image' : 'text')
  const [visualTitle, setVisualTitle] = useState('')
  const [visualSubtitle, setVisualSubtitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [improving, setImproving] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState('')
  const [reportId, setReportId] = useState('')
  const [usageMessage, setUsageMessage] = useState('')
  const [usageError, setUsageError] = useState('')
  const [showPromptHelp, setShowPromptHelp] = useState(false)

  const selectedClass = classes.find((cls) => cls.id === selectedClassId) ?? classes[0]
  const selectedStudent = allStudents.find((student) => student.id === selectedStudentId) ?? allStudents[0]

  useEffect(() => {
    setTeacherPrompt(RECOMMENDED_PROMPTS[documentType] ?? '')
  }, [documentType])

  const prevModeRef = useRef(mode)
  useEffect(() => {
    if (prevModeRef.current === mode) return
    prevModeRef.current = mode
    setDocumentType(defaultDocumentTypeForMode(mode))
    if (mode === 'free') setFreeOutput('text')
  }, [mode])

  useEffect(() => {
    if (mode === 'free') {
      setDocumentType(outputFormatForFreeChoice(freeOutput))
    }
  }, [freeOutput, mode])

  const guidedUsesAnnotations = mode === 'guided' && guidedTypeUsesAnnotations(documentType)
  const showAnnotationSource = guidedUsesAnnotations

  useEffect(() => {
    if (mode === 'visual_portfolio' || (mode === 'guided' && !guidedTypeUsesAnnotations(documentType))) {
      setSourceMode('prompt_only')
    }
  }, [documentType, mode])

  const selectedNotes = useMemo(() => {
    if (sourceMode === 'prompt_only') return []
    const classId = selectedClass?.id
    const studentId = selectedStudent?.id
    const studentName = selectedStudent?.name
    const picked = annotations.filter((annotation) => {
      if (sourceMode === 'student_notes' || (mode === 'visual_portfolio' && sourceMode !== 'class_notes')) {
        return matchesStudent(annotation, studentId, studentName)
      }
      if (sourceMode === 'class_notes') {
        return matchesClass(annotation, classId)
      }
      if (sourceMode === 'notes_and_prompt') {
        return matchesStudent(annotation, studentId, studentName) || matchesClass(annotation, classId)
      }
      return false
    })
    const unique = new Map<string, Annotation>()
    picked.forEach((item) => unique.set(item.id, item))
    return Array.from(unique.values())
  }, [annotations, mode, selectedClass?.id, selectedStudent?.id, selectedStudent?.name, sourceMode])

  const notesSummary = useMemo(() => {
    if (!selectedNotes.length) return null
    const dates = selectedNotes.map((note) => note.date).filter(Boolean).sort()
    const categories = Array.from(new Set(selectedNotes.map((note) => note.label).filter(Boolean)))
    return {
      count: selectedNotes.length,
      periodStart: dates[0] ?? '—',
      periodEnd: dates[dates.length - 1] ?? '—',
      categories: categories.slice(0, 4),
    }
  }, [selectedNotes])

  const outputFormat: CreatorPayload['outputFormat'] = mode === 'free'
    ? freeOutput
    : mode === 'visual_portfolio'
      ? 'image'
      : 'text'

  const canGenerate = useMemo(() => {
    if (generating || generatingRef.current) return false
    if (mode !== 'free' && !documentType) return false
    const needsNotes = guidedUsesAnnotations
    if (needsNotes && selectedNotes.length === 0) return false
    if (mode === 'free' && teacherPrompt.trim().length < 8) return false
    if (mode !== 'free' && sourceMode === 'prompt_only' && teacherPrompt.trim().length < 8) return false
    if (mode === 'guided' && documentType === 'other_pedagogical' && otherDocumentTitle.trim().length < 3) return false
    if ((sourceMode === 'student_notes' || sourceMode === 'notes_and_prompt') && !selectedStudent?.id && showAnnotationSource) return false
    if (sourceMode === 'class_notes' && !selectedClass?.id && showAnnotationSource) return false
    return true
  }, [documentType, freeOutput, generating, guidedUsesAnnotations, mode, otherDocumentTitle, selectedClass?.id, selectedNotes.length, selectedStudent?.id, showAnnotationSource, sourceMode, teacherPrompt])

  function toggleTone(next: CreatorTone) {
    setTone((current) => (current === next ? null : next))
  }

  function toggleVisualStyle(next: CreatorVisualStyle) {
    setVisualStyle((current) => (current === next ? null : next))
  }

  function buildPayload(): CreatorPayload {
    return {
      mode,
      documentType: mode === 'free' ? outputFormatForFreeChoice(freeOutput) : documentType,
      outputFormat,
      sourceMode: mode === 'free' ? 'prompt_only' : sourceMode,
      title: mode === 'guided' && documentType === 'other_pedagogical'
        ? otherDocumentTitle.trim() || undefined
        : title.trim() || undefined,
      teacherPrompt: teacherPrompt.trim(),
      selectedNotes: selectedNotes.map((note) => ({
        id: note.id,
        date: note.date,
        label: note.label,
        text: note.text,
      })),
      annotationIds: selectedNotes.map((note) => note.id),
      studentContext: selectedStudent ? {
        id: selectedStudent.id,
        name: selectedStudent.name,
        className: selectedStudent.className,
      } : undefined,
      classContext: selectedClass ? {
        id: selectedClass.id,
        name: selectedClass.name,
      } : undefined,
      tone: tone ?? undefined,
      visualStyle: visualStyle ?? undefined,
      imageFormat,
      visualOptions: mode === 'visual_portfolio' ? {
        visualTitle: visualTitle || undefined,
        subtitle: visualSubtitle || undefined,
      } : undefined,
    }
  }

  async function handleImprovePrompt() {
    if (teacherPrompt.trim().length < 8) {
      setUsageError('Escreva um pedido mínimo antes de aprimorar.')
      return
    }
    setImproving(true)
    setUsageError('')
    try {
      const payload = buildPayload()
      const result = await improveCreatorPrompt({
        mode: payload.mode,
        documentType: payload.documentType,
        sourceMode: payload.sourceMode,
        outputFormat: payload.outputFormat,
        teacherPrompt: payload.teacherPrompt,
        studentContext: payload.studentContext,
        classContext: payload.classContext,
      })
      setTeacherPrompt(result.improvedPrompt ?? teacherPrompt)
      setUsageMessage(result.wallet?.giztokensRemaining != null
        ? `Prompt aprimorado. GizTokens restantes: ${result.wallet.giztokensRemaining}.`
        : 'Prompt aprimorado com sucesso.')
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Não foi possível aprimorar o prompt.')
    } finally {
      setImproving(false)
    }
  }

  async function handleGenerate() {
    if (!canGenerate || generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    setUsageError('')
    setUsageMessage('')
    setGenerated(false)
    setGeneratedText('')
    setGeneratedImageUrl('')
    setReportId('')

    try {
      const payload = buildPayload()
      const classId = selectedClass?.id ?? null
      const studentId = selectedStudent?.id ?? null

      if (mode === 'free' && freeOutput === 'image') {
        const result = await generateImage({
          description: payload.teacherPrompt,
          imageFormat: payload.imageFormat,
          classId,
          studentId,
        })
        if (!result.allowed || !result.imageDataUrl) {
          setUsageError(result.message || 'Não foi possível gerar a imagem.')
          return
        }
        setGeneratedImageUrl(result.imageDataUrl)
        setReportId(result.reportId ?? '')
        setUsageMessage(formatAiUsageMessage(result))
        setGenerated(true)
        celebrateAiGeneration()
        return
      }

      if (mode === 'visual_portfolio') {
        const result = await generateAiPortfolioImage({
          generationType: 'portfolio_image',
          classId,
          studentId: sourceMode === 'class_notes' ? null : studentId,
          promptVersion: 'creator-v2-visual',
          requestSummary: {
            creatorV2: true,
            mode: payload.mode,
            documentType: payload.documentType,
            teacherPrompt: payload.teacherPrompt,
            visualStyle: payload.visualStyle,
            imageFormat: payload.imageFormat,
            visualOptions: payload.visualOptions,
            selectedAnnotations: payload.selectedNotes,
          },
          primaryPhotoDataUrl: null,
        })
        if (!result.allowed || !result.imageDataUrl) {
          setUsageError(result.message || 'Não foi possível gerar o portfólio visual.')
          return
        }
        setGeneratedImageUrl(result.imageDataUrl)
        setReportId(result.reportId ?? '')
        setUsageMessage(formatAiUsageMessage(result))
        setGenerated(true)
        celebrateAiGeneration()
        return
      }

      const result = await generateCreatorDocument({ creator: payload, classId, studentId })
      if (!result.allowed || !result.generatedText) {
        setUsageError(result.message || 'Não foi possível gerar o documento.')
        return
      }
      setGeneratedText(result.generatedText)
      setReportId(result.reportId ?? '')
      const usageLabel = result.wallet?.giztokensRemaining != null
        ? `GizTokens restantes: ${result.wallet.giztokensRemaining}.`
        : result.message ?? 'Documento gerado.'
      setUsageMessage(
        result.giztokensCharged
          ? `${usageLabel} Usado nesta geração: ${result.giztokensCharged} GizTokens.`
          : usageLabel,
      )
      setGenerated(true)
      celebrateAiGeneration()
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Não foi possível gerar agora.')
    } finally {
      generatingRef.current = false
      setGenerating(false)
    }
  }

  if (generating) {
    return (
      <div className="flex flex-col h-full bg-cream">
        <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border">
          <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-[18px] text-gd">Gerando...</span>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0 px-[18px]">
          {outputFormat === 'image'
            ? <GenerationImageLoadingScreen />
            : <GenerationDocumentLoadingScreen variant="report" />}
        </div>
      </div>
    )
  }

  if (generated) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-cream">
        <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border">
          <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-[18px] text-gd flex-1">Documento gerado</span>
        </div>
        <div className="scroll-area px-[18px] py-5">
          {usageMessage && (
            <p className="mb-3 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] text-gd">{usageMessage}</p>
          )}
          <div className="bg-white rounded-app p-5 border border-border shadow-card mb-4">
            {generatedImageUrl ? (
              <img src={generatedImageUrl} alt="Resultado gerado" className="w-full rounded-app-sm border border-border" />
            ) : (
              <div
                className="document-editor text-[13px] text-ink leading-[1.8]"
                dangerouslySetInnerHTML={{ __html: normalizeReportBodyHtml(generatedText) }}
              />
            )}
          </div>
          {reportId && (
            <button
              onClick={() => openSubscreen('document-detail', { reportId })}
              className="w-full py-3 rounded-app bg-gd text-white font-bold text-[14px] mb-3"
            >
              Abrir documento
            </button>
          )}
          <button
            onClick={() => {
              setGenerated(false)
              setUsageMessage('')
            }}
            className="w-full py-3 rounded-app border border-gp bg-gbg text-gd font-bold text-[14px]"
          >
            Criar outro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Criador Pedagógico</span>
      </div>

      <div className="scroll-area px-[18px] py-5 pb-10">
        <div className="rounded-app p-5 mb-5 text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
          <p className="text-[12px] opacity-70 mb-1">Com inteligência artificial</p>
          <h2 className="font-serif text-[22px] mb-2">O que você deseja criar?</h2>
          <p className="text-[13px] opacity-80 leading-[1.6]">
            Crie relatórios, planejamentos, diários, portfólios ou documentos livres a partir do título, das suas instruções e das anotações autorizadas.
          </p>
        </div>

        <div className="flex flex-col gap-2 mb-5">
          {CREATOR_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-app border px-4 py-3 text-left ${mode === item.id ? 'border-gd bg-gbg' : 'border-border bg-white'}`}
            >
              <p className="text-[14px] font-bold text-ink">{item.title}</p>
              <p className="text-[12px] text-muted mt-1 leading-[1.5]">{item.description}</p>
            </button>
          ))}
        </div>

        {mode === 'free' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['text', 'image'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setFreeOutput(choice)}
                className={`rounded-app-sm border py-3 text-[13px] font-bold ${freeOutput === choice ? 'bg-gd text-white border-gd' : 'bg-white text-muted border-border'}`}
              >
                {choice === 'text' ? 'Texto livre' : 'Imagem livre'}
              </button>
            ))}
          </div>
        )}

        {mode === 'guided' && (
          <>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Tipo de documento</label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as CreatorDocumentType)}
              className="w-full mt-2 mb-4 rounded-app-sm border border-border bg-white px-3 py-3 text-[13px] text-ink"
            >
              {GUIDED_TYPES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>

            {documentType === 'other_pedagogical' && (
              <>
                <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Título do documento desejado</label>
                <input
                  value={otherDocumentTitle}
                  onChange={(event) => setOtherDocumentTitle(event.target.value)}
                  placeholder="Ex.: Registro de adaptação curricular"
                  className="w-full mt-2 mb-4 rounded-app-sm border border-border bg-white px-3 py-3 text-[13px]"
                />
              </>
            )}
          </>
        )}

        {mode === 'visual_portfolio' && (
          <>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Tipo de portfólio visual</label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as CreatorDocumentType)}
              className="w-full mt-2 mb-4 rounded-app-sm border border-border bg-white px-3 py-3 text-[13px] text-ink"
            >
              {VISUAL_TYPES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </>
        )}

        {showAnnotationSource && (
          <>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Fonte do conteúdo</label>
            <div className="grid grid-cols-1 gap-2 mt-2 mb-4">
              {SOURCE_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSourceMode(item.id)}
                  className={`rounded-app-sm border px-3 py-3 text-left text-[13px] font-bold ${sourceMode === item.id ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {showAnnotationSource && sourceMode !== 'prompt_only' && (
          <div className="bg-white rounded-app border border-border p-4 mb-4">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Turma</label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full mt-2 mb-3 rounded-app-sm border border-border bg-cream px-3 py-2 text-[13px]"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>

            {(sourceMode === 'student_notes' || sourceMode === 'notes_and_prompt') && (
              <>
                <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Criança</label>
                <select
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  className="w-full mt-2 rounded-app-sm border border-border bg-cream px-3 py-2 text-[13px]"
                >
                  {(selectedClass?.students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </>
            )}

            {notesSummary && (
              <div className="mt-4 rounded-app-sm border border-gp bg-gbg px-3 py-3">
                <p className="text-[12px] font-bold text-gd mb-2">Resumo antes de gerar</p>
                <p className="text-[12px] text-ink">Anotações selecionadas: {notesSummary.count}</p>
                <p className="text-[12px] text-ink">Período: {notesSummary.periodStart} — {notesSummary.periodEnd}</p>
                {notesSummary.categories.length > 0 && (
                  <p className="text-[12px] text-ink">Categorias: {notesSummary.categories.join(', ')}</p>
                )}
                <p className="text-[11px] text-muted mt-2 leading-[1.5]">
                  A IA utilizará essas anotações como base principal para criar o documento.
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'guided' && documentType !== 'other_pedagogical' && (
          <>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Título do documento</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Relatório de março"
              className="w-full mt-2 mb-4 rounded-app-sm border border-border bg-white px-3 py-3 text-[13px]"
            />
          </>
        )}

        {mode === 'visual_portfolio' && (
          <div className="grid grid-cols-1 gap-2 mb-4">
            <input
              value={visualTitle}
              onChange={(event) => setVisualTitle(event.target.value)}
              placeholder="Título visual (opcional)"
              className="rounded-app-sm border border-border bg-white px-3 py-2 text-[13px]"
            />
            <input
              value={visualSubtitle}
              onChange={(event) => setVisualSubtitle(event.target.value)}
              placeholder="Subtítulo (opcional)"
              className="rounded-app-sm border border-border bg-white px-3 py-2 text-[13px]"
            />
          </div>
        )}

        {mode === 'visual_portfolio' && (
          <div className="mb-4">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">
              Estilo visual rápido <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <p className="text-[11px] text-muted mt-1 mb-2 leading-[1.5]">
              Escolha um estilo para orientar cores e composição da imagem. Toque de novo para desmarcar.
            </p>
            <div className="grid grid-cols-2 gap-2">
            {VISUAL_STYLES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleVisualStyle(item.id)}
                className={`rounded-app-sm border py-2 text-[12px] font-bold ${visualStyle === item.id ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>
        )}

        {(mode === 'visual_portfolio' || (mode === 'free' && freeOutput === 'image')) && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {IMAGE_FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setImageFormat(item.id)}
                className={`rounded-app-sm border py-2 text-[12px] font-bold ${imageFormat === item.id ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'guided' && (
          <div className="mb-4">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">
              Tom do texto <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <p className="text-[11px] text-muted mt-1 mb-2 leading-[1.5]">
              Toque em uma opção para selecionar. Toque de novo na mesma opção para desmarcar.
            </p>
            <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleTone(item.id)}
                className={`rounded-app-sm border py-2 text-[12px] font-bold ${tone === item.id ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>
        )}

        {mode !== 'free' ? (
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">
              Prompt da professora
            </label>
            <button
              type="button"
              onClick={() => setShowPromptHelp((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full border border-[#F1D58B] bg-[#FFF8DC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#6B5300]"
              aria-expanded={showPromptHelp}
            >
              <CircleAlert size={13} strokeWidth={2.2} />
              Entenda
            </button>
          </div>
        ) : (
          <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">
            O que você quer criar?
          </label>
        )}

        {mode !== 'free' && showPromptHelp && (
          <div className="mb-2 rounded-app-sm border border-[#F1D58B] bg-[#FFF8DC] px-3 py-3 text-[12px] leading-[1.6] text-[#6B5300]">
            Colocamos um modelo pronto para orientar a geração — você não precisa usar exatamente assim.
            Pode editar, apagar ou escrever do seu jeito. Se quiser, use o botão abaixo para a IA organizar
            melhor o seu pedido antes de gerar o documento.
          </div>
        )}

        <textarea
          value={teacherPrompt}
          onChange={(event) => setTeacherPrompt(event.target.value)}
          className="w-full mt-2 min-h-[180px] rounded-app-sm border border-border bg-white px-3 py-3 text-[13px] text-ink leading-[1.7] outline-none resize-y"
        />

        {mode !== 'free' && (
          <button
            type="button"
            onClick={handleImprovePrompt}
            disabled={improving}
            className="mt-3 mb-4 w-full rounded-app-sm border border-gp bg-gbg py-3 text-[12px] font-bold text-gd disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Wand2 size={14} />
            {improving ? 'Aprimorando...' : 'Clique aqui para aprimorar texto com IA'}
          </button>
        )}

        {(usageError || usageMessage) && (
          <p className={`mb-4 rounded-app-sm border px-3 py-2 text-[12px] ${usageError ? 'border-red-200 bg-red-50 text-red-700' : 'border-gp bg-gbg text-gd'}`}>
            {usageError || usageMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={18} />
          {mode === 'free' && freeOutput === 'image' ? 'Gerar imagem' : 'Gerar documento'}
        </button>
      </div>
    </div>
  )
}
