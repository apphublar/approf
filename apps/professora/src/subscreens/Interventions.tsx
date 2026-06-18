import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import { generateAiTextDocument } from '@/services/ai-usage'
import { deleteInterventionRecord, saveInterventionRecord } from '@/services/supabase/interventions'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import GenerationDocumentLoadingScreen from '@/components/ui/GenerationDocumentLoadingScreen'
import type {
  InterventionActivityEntry,
  InterventionHistoryItem,
  InterventionReturnChoice,
  InterventionSuggestion,
} from '@/types'

type Step = 'form' | 'suggestions' | 'chosen' | 'feedback' | 'analysis' | 'detail'

type InterventionDraft = {
  selectedStudentIds: string[]
  activeStudentIndex: number
  observation: string
  generatedObservation: string
  teacherReturn: string
  returnChoice: InterventionReturnChoice
  step: Step
  suggestions: InterventionSuggestion[]
  chosenSuggestion: InterventionSuggestion | null
  activeInterventionId: string
  historyFilterStudentId: string
}

export default function InterventionsSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeStudentId, interventions, addIntervention, updateIntervention, removeIntervention, addAnnotation, userId } = useAppStore()

  const allStudents = useMemo(
    () => classes.flatMap((classData) => classData.students.map((student) => ({ ...student, classId: classData.id, className: classData.name }))),
    [classes],
  )

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [classes],
  )

  const defaultStudentId = activeStudentId ?? allStudents[0]?.id ?? ''
  const defaultClassId = classes.find((classData) => classData.students.some((student) => student.id === defaultStudentId))?.id
    ?? sortedClasses[0]?.id
    ?? ''

  const skipStudentResetRef = useRef(false)
  const restoringDraftRef = useRef(false)

  const [selectedClassId, setSelectedClassId] = useState(defaultClassId)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(defaultStudentId ? [defaultStudentId] : [])
  const [activeStudentIndex, setActiveStudentIndex] = useState(0)
  const [historyFilterStudentId, setHistoryFilterStudentId] = useState('all')
  const [observation, setObservation] = useState('')
  const [generatedObservation, setGeneratedObservation] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [generating, setGenerating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<InterventionSuggestion[]>([])
  const [chosenSuggestion, setChosenSuggestion] = useState<InterventionSuggestion | null>(null)
  const [teacherReturn, setTeacherReturn] = useState('')
  const [returnChoice, setReturnChoice] = useState<InterventionReturnChoice>('houve_avanco')
  const [analysisReturnChoice, setAnalysisReturnChoice] = useState<InterventionReturnChoice>('houve_avanco')
  const [analysisText, setAnalysisText] = useState('')
  const [followupSuggestions, setFollowupSuggestions] = useState<InterventionSuggestion[]>([])
  const [activeInterventionId, setActiveInterventionId] = useState('')
  const [detailItem, setDetailItem] = useState<InterventionHistoryItem | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [pendingStudentQueue, setPendingStudentQueue] = useState<string[]>([])

  const draftKey = `approf:draft:interventions:${userId}`
  const generationViewKey = (generating || analyzing) ? 'loading' : step

  const currentStudentId = selectedStudentIds[activeStudentIndex] ?? selectedStudentIds[0] ?? ''
  const selectedStudent = allStudents.find((student) => student.id === currentStudentId) ?? allStudents[0]
  const hasMultipleClasses = sortedClasses.length > 1

  const studentsInSelectedClass = useMemo(() => {
    const classItem = sortedClasses.find((item) => item.id === selectedClassId) ?? sortedClasses[0]
    if (!classItem) return []
    return [...classItem.students].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [selectedClassId, sortedClasses])

  const sortedAllStudents = useMemo(
    () => [...allStudents].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allStudents],
  )

  const filteredHistory = useMemo(() => {
    const sorted = [...interventions].sort((a, b) => {
      const left = parseHistoryDate(b.createdAt)
      const right = parseHistoryDate(a.createdAt)
      return left - right
    })
    if (historyFilterStudentId === 'all') return sorted
    return sorted.filter((item) => item.studentId === historyFilterStudentId)
  }, [historyFilterStudentId, interventions])

  useEffect(() => {
    if (!currentStudentId) return
    const classId = allStudents.find((student) => student.id === currentStudentId)?.classId
    if (classId && classId !== selectedClassId) {
      setSelectedClassId(classId)
    }
  }, [allStudents, currentStudentId, selectedClassId])

  useEffect(() => {
    if (sortedClasses.length === 1 && sortedClasses[0].id !== selectedClassId) {
      setSelectedClassId(sortedClasses[0].id)
    }
  }, [selectedClassId, sortedClasses])

  useEffect(() => {
    if (skipStudentResetRef.current) {
      skipStudentResetRef.current = false
      return
    }
    if (restoringDraftRef.current) return
    if (step === 'form') {
      setObservation('')
      setGeneratedObservation('')
      setSuggestions([])
      setChosenSuggestion(null)
      setTeacherReturn('')
      setAnalysisText('')
      setFollowupSuggestions([])
      setActiveInterventionId('')
      setReturnChoice('houve_avanco')
      setAnalysisReturnChoice('houve_avanco')
      setError('')
    }
  }, [currentStudentId, step])

  useEffect(() => {
    restoringDraftRef.current = true
    const draft = loadDraft<InterventionDraft>(draftKey)
    if (draft) {
      if (draft.selectedStudentIds?.length) setSelectedStudentIds(draft.selectedStudentIds)
      if (typeof draft.activeStudentIndex === 'number') setActiveStudentIndex(draft.activeStudentIndex)
      setObservation(draft.observation || '')
      setGeneratedObservation(draft.generatedObservation || '')
      setTeacherReturn(draft.teacherReturn || '')
      setReturnChoice(draft.returnChoice || 'houve_avanco')
      setSuggestions(Array.isArray(draft.suggestions) ? draft.suggestions : [])
      setChosenSuggestion(draft.chosenSuggestion ?? null)
      setActiveInterventionId(draft.activeInterventionId || '')
      if (draft.historyFilterStudentId) setHistoryFilterStudentId(draft.historyFilterStudentId)
      if (draft.step && draft.step !== 'detail') setStep(draft.step)
      setDraftMessage('Rascunho recuperado')
    }
    restoringDraftRef.current = false
  }, [draftKey])

  useEffect(() => {
    if (!['form', 'feedback', 'chosen'].includes(step)) return
    const timeout = window.setTimeout(() => {
      saveDraft(draftKey, {
        selectedStudentIds,
        activeStudentIndex,
        observation,
        generatedObservation,
        teacherReturn,
        returnChoice,
        step,
        suggestions,
        chosenSuggestion,
        activeInterventionId,
        historyFilterStudentId,
      } satisfies InterventionDraft)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [
    activeInterventionId,
    activeStudentIndex,
    chosenSuggestion,
    draftKey,
    generatedObservation,
    historyFilterStudentId,
    observation,
    returnChoice,
    selectedStudentIds,
    step,
    suggestions,
    teacherReturn,
  ])

  useEffect(() => {
    if (!draftMessage) return
    const timeout = window.setTimeout(() => setDraftMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [draftMessage])

  function handleClassChange(classId: string) {
    setSelectedClassId(classId)
    const nextStudents = [...(sortedClasses.find((item) => item.id === classId)?.students ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const nextStudentId = nextStudents[0]?.id ?? ''
    if (nextStudentId) {
      setSelectedStudentIds([nextStudentId])
      setActiveStudentIndex(0)
    }
  }

  function handleStudentChange(studentId: string) {
    setSelectedStudentIds([studentId])
    setActiveStudentIndex(0)
  }

  function validateAnalyzeReturn() {
    if (!selectedStudent) {
      setError('Selecione ao menos uma criança para continuar.')
      return false
    }
    if (!chosenSuggestion) {
      setError('A intervenção escolhida não foi encontrada. Volte e selecione uma estratégia novamente.')
      return false
    }
    if (teacherReturn.trim().length < 8) {
      setError('Descreva o retorno com pelo menos 8 caracteres.')
      return false
    }
    return true
  }

  async function handleGenerateSuggestions(forStudentId?: string) {
    const student = allStudents.find((item) => item.id === (forStudentId ?? currentStudentId)) ?? selectedStudent
    if (!student || observation.trim().length < 12) return
    if (selectedStudentIds.length === 0) {
      setError('Selecione ao menos uma criança.')
      return
    }

    setGenerating(true)
    setError('')
    setSuggestions([])
    setChosenSuggestion(null)
    setFollowupSuggestions([])
    setAnalysisText('')

    try {
      const result = await generateAiTextDocument({
        generationType: 'other',
        classId: student.classId,
        studentId: student.id,
        promptVersion: 'interventions-v1',
        requestSummary: {
          interventionMode: 'suggestions',
          studentName: student.name,
          studentAge: `${student.age} anos${student.ageMonths ? ` e ${student.ageMonths} meses` : ''}`,
          className: student.className,
          observation,
          selectedStudents: selectedStudentIds.length > 1
            ? selectedStudentIds.map((id) => allStudents.find((entry) => entry.id === id)?.name).filter(Boolean)
            : undefined,
        },
      })

      if (!result.allowed || !result.generatedText) {
        setError(result.message || 'Não foi possível gerar sugestões agora.')
        return
      }

      const parsedSuggestions = parseInterventionSuggestions(result.generatedText)
      if (parsedSuggestions.length < 3) {
        setError('Não foi possível estruturar sugestões suficientes agora. Tente novamente.')
        return
      }

      setSuggestions(parsedSuggestions)
      setGeneratedObservation(observation.trim())
      setStep('suggestions')
      setObservation('')
      clearDraft(draftKey)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar sugestões agora.')
    } finally {
      setGenerating(false)
    }
  }

  async function chooseIntervention(suggestion: InterventionSuggestion) {
    setChosenSuggestion(suggestion)
    const itemId = activeInterventionId || `int-${Date.now()}`
    setActiveInterventionId(itemId)
    setStep('chosen')
    if (selectedStudent) {
      await persistIntervention({
        id: itemId,
        status: 'em_acompanhamento',
        chosenIntervention: suggestion,
        suggestions,
        appendLog: {
          type: 'chosen',
          label: `Intervenção escolhida: ${suggestion.title}`,
          chosenIntervention: suggestion,
        },
      })
    }
  }

  async function openFeedbackStep() {
    if (!chosenSuggestion) {
      setError('Selecione uma intervenção antes de registrar o retorno.')
      return
    }
    setError('')
    if (selectedStudent && activeInterventionId) {
      await persistIntervention({
        id: activeInterventionId,
        status: 'em_acompanhamento',
        chosenIntervention: chosenSuggestion,
        suggestions,
      })
    }
    setStep('feedback')
  }

  async function chooseFollowupIntervention(suggestion: InterventionSuggestion) {
    if (!selectedStudent || !activeInterventionId) return

    const nextSuggestions = followupSuggestions.length > 0 ? followupSuggestions : [suggestion]
    try {
      const saved = await persistIntervention({
        id: activeInterventionId,
        status: 'em_acompanhamento',
        suggestions: nextSuggestions,
        chosenIntervention: suggestion,
        appendLog: {
          type: 'followup_chosen',
          label: `Nova estratégia escolhida: ${suggestion.title}`,
          chosenIntervention: suggestion,
        },
      })
      setActiveInterventionId(saved.id)
      setSuggestions(nextSuggestions)
      setChosenSuggestion(suggestion)
      setTeacherReturn('')
      setReturnChoice('houve_avanco')
      setFollowupSuggestions([])
      setAnalysisText('')
      setStep('chosen')
    } catch {
      // persistIntervention already sets error
    }
  }

  function closeWithoutRegistering() {
    closeSubscreen()
  }

  async function savePendingIntervention() {
    if (!selectedStudent || !chosenSuggestion || !activeInterventionId) return
    await persistIntervention({
      id: activeInterventionId,
      status: 'pendente',
      chosenIntervention: chosenSuggestion,
      suggestions,
      appendLog: {
        type: 'chosen',
        label: `Intervenção salva para acompanhar: ${chosenSuggestion.title}`,
        chosenIntervention: chosenSuggestion,
      },
    })
    closeSubscreen()
  }

  function resumeIntervention(item: InterventionHistoryItem) {
    if (!item.chosenIntervention) return
    skipStudentResetRef.current = true
    setSelectedStudentIds([item.studentId])
    setActiveStudentIndex(0)
    setGeneratedObservation(item.observationInitial)
    setObservation(item.observationInitial)
    setSuggestions(item.suggestions)
    setChosenSuggestion(item.chosenIntervention)
    setActiveInterventionId(item.id)
    setTeacherReturn(item.teacherReturn ?? '')
    setReturnChoice(item.returnChoice ?? 'houve_avanco')
    setDetailItem(null)
    setError('')
    setStep('feedback')
  }

  function openHistoryDetail(item: InterventionHistoryItem) {
    setDetailItem(item)
    setStep('detail')
  }

  async function completeIntervention(options?: { item?: InterventionHistoryItem; note?: string }) {
    const base = options?.item ?? interventions.find((item) => item.id === activeInterventionId)
    if (!base) return

    const note = options?.note ?? 'Intervenção concluída pela professora.'
    const activityLog = [
      ...(base.activityLog ?? []),
      {
        at: new Date().toISOString(),
        type: 'concluded' as const,
        label: note,
        returnChoice: base.returnChoice ?? analysisReturnChoice,
        aiAnalysis: base.aiAnalysis ?? analysisText,
      },
    ]

    const item: InterventionHistoryItem = {
      ...base,
      status: 'concluida',
      teacherReturn: base.teacherReturn ?? note,
      returnChoice: base.returnChoice ?? analysisReturnChoice,
      aiAnalysis: base.aiAnalysis ?? analysisText,
      updatedAt: new Date().toISOString(),
      activityLog,
    }

    try {
      const saved = getAppDataMode() === 'supabase'
        ? await saveInterventionRecord(item)
        : item
      updateIntervention(saved)
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : 'Não foi possível concluir a intervenção.')
      return
    }

    const remainingQueue = pendingStudentQueue.filter((id) => id !== base.studentId)
    setPendingStudentQueue(remainingQueue)

    if (remainingQueue.length > 0) {
      const nextId = remainingQueue[0]
      skipStudentResetRef.current = true
      setSelectedStudentIds([nextId])
      setActiveStudentIndex(0)
      setStep('form')
      setObservation('')
      setGeneratedObservation('')
      setSuggestions([])
      setChosenSuggestion(null)
      setTeacherReturn('')
      setAnalysisText('')
      setFollowupSuggestions([])
      setActiveInterventionId('')
      setDetailItem(null)
      setDraftMessage(`Intervenção concluída. Continue com ${allStudents.find((student) => student.id === nextId)?.name ?? 'a próxima criança'}.`)
      return
    }

    setStep('form')
    setChosenSuggestion(null)
    setAnalysisText('')
    setFollowupSuggestions([])
    setDetailItem(null)
    clearDraft(draftKey)
  }

  async function completeWithoutAnalysis(item: InterventionHistoryItem) {
    await completeIntervention({ item, note: 'Intervenção concluída manualmente pela professora.' })
  }

  async function discardIntervention(item: InterventionHistoryItem) {
    const confirmed = window.confirm('Deseja remover esta intervenção do histórico?')
    if (!confirmed) return
    try {
      if (getAppDataMode() === 'supabase') {
        await deleteInterventionRecord(item.id)
      }
      removeIntervention(item.id)
      if (detailItem?.id === item.id) {
        setDetailItem(null)
        setStep('form')
      }
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : 'Não foi possível remover a intervenção.')
    }
  }

  async function handleAnalyzeReturn() {
    if (!validateAnalyzeReturn()) return

    setAnalyzing(true)
    setError('')

    try {
      const result = await generateAiTextDocument({
        generationType: 'other',
        classId: selectedStudent!.classId,
        studentId: selectedStudent!.id,
        promptVersion: 'interventions-feedback-v1',
        requestSummary: {
          interventionMode: 'feedback_analysis',
          studentName: selectedStudent!.name,
          observationInitial: generatedObservation || observation,
          interventionChosen: chosenSuggestion,
          teacherReturn,
          returnChoice,
        },
      })

      if (!result.allowed || !result.generatedText) {
        setError(result.message || 'Não foi possível analisar o retorno agora.')
        return
      }

      const parsed = parseInterventionFeedback(result.generatedText)
      const status = returnChoice === 'houve_avanco' ? 'concluida' : 'em_acompanhamento'
      const itemId = activeInterventionId || `int-${Date.now()}`

      const saved = await persistIntervention({
        id: itemId,
        status,
        chosenIntervention: chosenSuggestion!,
        suggestions,
        teacherReturn: teacherReturn.trim(),
        returnChoice,
        aiAnalysis: parsed.analysisText,
        evolutionRecord: parsed.evolutionRecord,
        appendLog: {
          type: 'analysis',
          label: formatReturnChoiceLabel(returnChoice),
          teacherReturn: teacherReturn.trim(),
          returnChoice,
          aiAnalysis: parsed.analysisText,
          evolutionRecord: parsed.evolutionRecord,
        },
      })
      setActiveInterventionId(saved.id)

      if (returnChoice === 'houve_avanco') {
        addAnnotation({
          id: `ann-int-${Date.now()}`,
          category: 'evolucao',
          label: 'Evolução de intervenção',
          badgeClass: 'badge-ev',
          studentName: selectedStudent!.name,
          text: parsed.evolutionRecord || parsed.analysisText,
          date: 'Agora',
          classId: selectedStudent!.classId,
          studentId: selectedStudent!.id,
          tags: ['Intervenção', 'Houve avanço'],
          persistence: ['observacao-continua', 'evolucao-positiva'],
        })
      }

      setAnalysisText(parsed.analysisText)
      setAnalysisReturnChoice(returnChoice)
      const needsFollowup = returnChoice !== 'houve_avanco'
      setFollowupSuggestions(needsFollowup ? parsed.recommendedSuggestions : [])
      setStep('analysis')
      setTeacherReturn('')
      setReturnChoice('houve_avanco')
      clearDraft(draftKey)
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Não foi possível analisar o retorno agora.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function persistIntervention(input: {
    id: string
    status: InterventionHistoryItem['status']
    suggestions?: InterventionSuggestion[]
    chosenIntervention?: InterventionSuggestion
    teacherReturn?: string
    returnChoice?: InterventionReturnChoice
    aiAnalysis?: string
    evolutionRecord?: string
    appendLog?: Omit<InterventionActivityEntry, 'at'>
  } & Partial<InterventionHistoryItem>) {
    if (!selectedStudent) throw new Error('Criança não selecionada.')

    const existing = interventions.find((item) => item.id === input.id)
    const activityLog = [...(existing?.activityLog ?? input.activityLog ?? [])]
    if (input.appendLog) {
      activityLog.push({ at: new Date().toISOString(), ...input.appendLog })
    }

    const item: InterventionHistoryItem = {
      id: input.id,
      studentId: input.studentId ?? selectedStudent.id,
      studentName: input.studentName ?? selectedStudent.name,
      classId: input.classId ?? selectedStudent.classId,
      className: input.className ?? selectedStudent.className,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      observationInitial: input.observationInitial ?? (generatedObservation || observation.trim()),
      suggestions: input.suggestions ?? suggestions,
      chosenIntervention: input.chosenIntervention ?? chosenSuggestion ?? undefined,
      teacherReturn: input.teacherReturn ?? existing?.teacherReturn,
      returnChoice: input.returnChoice ?? existing?.returnChoice,
      aiAnalysis: input.aiAnalysis ?? existing?.aiAnalysis,
      evolutionRecord: input.evolutionRecord ?? existing?.evolutionRecord,
      activityLog,
      status: input.status,
    }

    if (!existing && !activityLog.some((entry) => entry.type === 'created')) {
      activityLog.unshift({
        at: new Date().toISOString(),
        type: 'created',
        label: 'Intervenção iniciada',
      })
      item.activityLog = activityLog
    }

    try {
      const saved = getAppDataMode() === 'supabase'
        ? await saveInterventionRecord(item)
        : item
      const exists = interventions.some((current) => current.id === item.id || current.id === saved.id)
      if (exists) updateIntervention(saved)
      else addIntervention(saved)
      return saved
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : 'Não foi possível salvar a intervenção.')
      throw persistError
    }
  }

  function beginGenerationForSelection() {
    void handleGenerateSuggestions()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button
          onClick={() => {
            if (step === 'detail') {
              setStep('form')
              setDetailItem(null)
              return
            }
            closeSubscreen()
          }}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Intervenções</span>
      </div>

      <div key={generationViewKey} className="scroll-area px-[18px] py-4 stage-fade-in">
        {!selectedStudent && step !== 'detail' && (
          <div className="bg-white rounded-app border border-border shadow-card p-4">
            <p className="text-[13px] font-bold text-ink">Nenhuma criança encontrada</p>
            <p className="text-[12px] text-muted mt-1 leading-[1.6]">
              Cadastre uma criança em Turmas para iniciar as intervenções pedagógicas.
            </p>
          </div>
        )}

        {(generating || analyzing) ? (
          <GenerationDocumentLoadingScreen variant="intervention" />
        ) : (
          <>
            {step === 'form' && selectedStudent && (
              <>
                <div className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
                  <p className="text-[13px] text-soft leading-[1.6]">
                    Registre uma observação e receba sugestões pedagógicas alinhadas à BNCC para a criança selecionada.
                  </p>
                  {pendingStudentQueue.length > 0 && (
                    <p className="mt-2 text-[11px] text-gm font-bold leading-[1.5]">
                      Fila: {pendingStudentQueue.length} criança(s) aguardando após esta intervenção.
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
                  {hasMultipleClasses && (
                    <>
                      <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Turma</label>
                      <select
                        value={selectedClassId}
                        onChange={(event) => handleClassChange(event.target.value)}
                        className="w-full mt-2 mb-3 rounded-app-sm border border-border bg-cream px-3 py-3 text-[13px] text-ink"
                      >
                        {sortedClasses.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                        ))}
                      </select>
                    </>
                  )}

                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Criança</label>
                  <select
                    value={currentStudentId}
                    onChange={(event) => handleStudentChange(event.target.value)}
                    className="w-full mt-2 rounded-app-sm border border-border bg-cream px-3 py-3 text-[13px] text-ink"
                  >
                    {studentsInSelectedClass.map((student) => (
                      <option key={student.id} value={student.id}>{student.name}</option>
                    ))}
                  </select>
                </div>

                <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Observação da professora</label>
                <textarea
                  className="w-full min-h-[160px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  placeholder="Descreva o que foi observado na rotina da criança..."
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                />

                <button
                  onClick={beginGenerationForSelection}
                  disabled={generating || observation.trim().length < 12 || selectedStudentIds.length === 0}
                  className="w-full mt-4 py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles size={17} />
                  Gerar sugestões
                </button>
              </>
            )}

            {step === 'suggestions' && (
              <>
                <p className="text-[13px] text-muted mb-1">{selectedStudent?.name}</p>
                <p className="text-[12px] text-muted mb-3">Selecione uma estratégia pedagógica para aplicar.</p>
                <div className="flex flex-col gap-3">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="bg-white rounded-app border border-border shadow-card p-4">
                      <p className="text-[13px] font-bold text-gd">{suggestion.title}</p>
                      <p className="text-[12px] text-muted mt-1 leading-[1.5]">{suggestion.summary}</p>
                      <p className="text-[12px] text-ink mt-2"><strong>Objetivo:</strong> {suggestion.objective}</p>
                      <button
                        onClick={() => void chooseIntervention(suggestion)}
                        className="w-full mt-3 py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[12px] font-bold"
                      >
                        Escolher esta intervenção
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 'chosen' && chosenSuggestion && (
              <div className="bg-white rounded-app border border-border shadow-card p-4">
                <p className="text-[12px] text-muted mb-2">{selectedStudent?.name}</p>
                <h3 className="text-[16px] font-bold text-gd">{chosenSuggestion.title}</h3>
                <p className="text-[12px] text-ink mt-3"><strong>Observação inicial:</strong> {generatedObservation || observation}</p>
                <p className="text-[12px] text-ink mt-3"><strong>Objetivo pedagógico:</strong> {chosenSuggestion.objective}</p>
                <p className="text-[12px] text-ink mt-3"><strong>Como aplicar:</strong> {chosenSuggestion.howToApply}</p>
                <p className="text-[12px] text-ink mt-3"><strong>O que observar:</strong> {chosenSuggestion.whatToObserve}</p>
                <p className="text-[12px] text-ink mt-3"><strong>Texto para registro:</strong> {chosenSuggestion.recordText}</p>

                <button
                  onClick={() => void openFeedbackStep()}
                  className="w-full mt-4 py-3 rounded-app-sm bg-gd text-white text-[13px] font-bold border-none"
                >
                  Registrar retorno
                </button>
                <button
                  onClick={closeWithoutRegistering}
                  className="w-full mt-2 py-3 rounded-app-sm border border-border bg-white text-muted text-[13px] font-bold"
                >
                  Fechar sem registrar
                </button>
                <button
                  onClick={() => void savePendingIntervention()}
                  className="w-full mt-2 py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[13px] font-bold"
                >
                  Salvar para acompanhar depois
                </button>
              </div>
            )}

            {step === 'feedback' && (
              <div className="bg-white rounded-app border border-border shadow-card p-4">
                <p className="text-[12px] font-bold text-gd mb-1">{selectedStudent?.name}</p>
                {chosenSuggestion && (
                  <p className="text-[11px] text-muted mb-3 leading-[1.5]">
                    Intervenção em andamento:
                    {' '}
                    <strong>{chosenSuggestion.title}</strong>
                  </p>
                )}
                <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Retorno da professora</label>
                <textarea
                  className="w-full min-h-[130px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  value={teacherReturn}
                  onChange={(event) => setTeacherReturn(event.target.value)}
                  placeholder="Descreva o que foi feito, como a criança reagiu e os resultados observados."
                />

                <div className="mt-3 flex flex-col gap-2">
                  <ChoiceOption selected={returnChoice === 'houve_avanco'} label="Houve avanço" onClick={() => setReturnChoice('houve_avanco')} />
                  <ChoiceOption selected={returnChoice === 'houve_avanco_parcial'} label="Houve avanço parcial" onClick={() => setReturnChoice('houve_avanco_parcial')} />
                  <ChoiceOption selected={returnChoice === 'necessita_acompanhamento'} label="Ainda necessita acompanhamento" onClick={() => setReturnChoice('necessita_acompanhamento')} />
                </div>

                {!chosenSuggestion && (
                  <p className="mt-3 text-[11px] text-[#C1440E] leading-[1.5]">
                    A intervenção escolhida não foi recuperada. Volte ao histórico e toque em Retomar, ou escolha uma estratégia novamente.
                  </p>
                )}

                <button
                  onClick={() => void handleAnalyzeReturn()}
                  disabled={!selectedStudent || !chosenSuggestion || analyzing || teacherReturn.trim().length < 8}
                  className="w-full mt-4 py-3 rounded-app-sm bg-gd text-white text-[13px] font-bold border-none disabled:opacity-50"
                >
                  Analisar retorno
                </button>
                {chosenSuggestion && (
                  <button
                    type="button"
                    onClick={() => setStep('chosen')}
                    className="w-full mt-2 py-3 rounded-app-sm border border-border bg-white text-muted text-[13px] font-bold"
                  >
                    Voltar à intervenção escolhida
                  </button>
                )}
              </div>
            )}

            {step === 'analysis' && (
              <div className="bg-white rounded-app border border-border shadow-card p-4">
                <p className="text-[12px] text-muted mb-1">{selectedStudent?.name}</p>
                <p className="text-[14px] font-bold text-gd mb-2">Análise pedagógica</p>
                <p className="text-[12px] text-soft leading-[1.6] whitespace-pre-wrap">{analysisText}</p>

                {analysisReturnChoice === 'houve_avanco' && (
                  <p className="mt-3 text-[12px] font-bold text-gd">Evolução registrada com sucesso.</p>
                )}

                {analysisReturnChoice === 'houve_avanco_parcial' && (
                  <p className="mt-3 rounded-app-sm border border-[#EAD58A] bg-[#FFF8D8] px-3 py-2 text-[11px] leading-[1.5] text-[#856404]">
                    Houve avanço parcial. Você pode iniciar uma nova estratégia ou concluir este ciclo de acompanhamento.
                  </p>
                )}

                {analysisReturnChoice === 'necessita_acompanhamento' && (
                  <p className="mt-3 rounded-app-sm border border-[#EAD58A] bg-[#FFF8D8] px-3 py-2 text-[11px] leading-[1.5] text-[#856404]">
                    A IA sugere novas alternativas. Escolha uma estratégia para continuar o acompanhamento ou conclua se preferir encerrar este ciclo.
                  </p>
                )}

                {followupSuggestions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[12px] font-bold text-ink mb-2">Novas estratégias sugeridas</p>
                    <div className="flex flex-col gap-2">
                      {followupSuggestions.map((suggestion) => (
                        <div key={suggestion.id} className="rounded-app-sm border border-border bg-cream p-3">
                          <p className="text-[12px] font-bold text-gd">{suggestion.title}</p>
                          <p className="text-[11px] text-muted mt-1">{suggestion.summary}</p>
                          <button
                            onClick={() => void chooseFollowupIntervention(suggestion)}
                            className="w-full mt-3 py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[12px] font-bold"
                          >
                            Escolher esta intervenção
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : analysisReturnChoice !== 'houve_avanco' && (
                  <p className="mt-3 text-[11px] text-muted leading-[1.5]">
                    Nenhuma alternativa extra foi gerada agora. Você pode concluir o ciclo ou retomar depois pelo histórico.
                  </p>
                )}

                {analysisReturnChoice !== 'houve_avanco' && (
                  <button
                    onClick={() => void completeIntervention({ note: 'Ciclo de intervenção concluído pela professora.' })}
                    className="w-full mt-4 py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[13px] font-bold"
                  >
                    Concluir e fechar intervenção
                  </button>
                )}

                <button
                  onClick={() => {
                    if (analysisReturnChoice === 'houve_avanco') void completeIntervention()
                    else closeSubscreen()
                  }}
                  className="w-full mt-2 py-3 rounded-app-sm bg-gd text-white text-[13px] font-bold border-none"
                >
                  {analysisReturnChoice === 'houve_avanco' ? 'Concluir' : 'Sair e acompanhar depois'}
                </button>
              </div>
            )}

            {step === 'detail' && detailItem && (
              <InterventionDetailView
                item={detailItem}
                onResume={() => resumeIntervention(detailItem)}
                onComplete={() => void completeWithoutAnalysis(detailItem)}
                onRemove={() => void discardIntervention(detailItem)}
              />
            )}

            {error && (
              <p className="mt-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-[1.5] text-red-700">
                {error}
              </p>
            )}
            {error && (step === 'form' || step === 'feedback') && (
              <button
                onClick={() => void (step === 'form' ? handleGenerateSuggestions() : handleAnalyzeReturn())}
                className="mt-2 w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
              >
                Tentar novamente
              </button>
            )}
            {draftMessage && <p className="mt-2 text-[12px] text-gm">{draftMessage}</p>}

            {step !== 'detail' && filteredHistory.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Histórico de intervenções</p>
                  <select
                    value={historyFilterStudentId}
                    onChange={(event) => setHistoryFilterStudentId(event.target.value)}
                    className="rounded-app-sm border border-border bg-white px-2 py-1 text-[11px] text-ink"
                  >
                    <option value="all">Todas as crianças</option>
                    {sortedAllStudents.map((student) => (
                      <option key={student.id} value={student.id}>{student.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 pb-8">
                  {filteredHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openHistoryDetail(item)}
                      className="bg-white rounded-app-sm border border-border p-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-ink">{item.chosenIntervention?.title ?? 'Intervenção pendente'}</p>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-gbg text-gd border border-gp flex-shrink-0">
                          {formatStatus(item.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gm mt-1 font-bold">{item.studentName} · {item.className}</p>
                      <p className="text-[10px] text-muted mt-1">Início: {item.createdAt}{item.updatedAt ? ` · Atualização: ${item.updatedAt}` : ''}</p>
                      <p className="text-[11px] text-muted mt-1 line-clamp-2">{item.observationInitial}</p>
                      {item.status !== 'concluida' && (
                        <div className="grid grid-cols-3 gap-2 mt-3" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => resumeIntervention(item)}
                            disabled={!item.chosenIntervention}
                            className="rounded-app-sm border border-gp bg-gbg px-2 py-2 text-[10px] font-bold text-gd disabled:opacity-50"
                          >
                            Retomar
                          </button>
                          <button
                            type="button"
                            onClick={() => void completeWithoutAnalysis(item)}
                            className="rounded-app-sm border border-border bg-white px-2 py-2 text-[10px] font-bold text-muted"
                          >
                            Finalizar
                          </button>
                          <button
                            type="button"
                            onClick={() => void discardIntervention(item)}
                            className="rounded-app-sm border border-red-200 bg-red-50 px-2 py-2 text-[10px] font-bold text-red-700"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InterventionDetailView({
  item,
  onResume,
  onComplete,
  onRemove,
}: {
  item: InterventionHistoryItem
  onResume: () => void
  onComplete: () => void
  onRemove: () => void
}) {
  const timeline = buildInterventionTimeline(item)

  return (
    <div className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Detalhe da intervenção</p>
      <h3 className="text-[16px] font-bold text-gd mt-2">{item.chosenIntervention?.title ?? 'Intervenção'}</h3>
      <p className="text-[12px] text-ink mt-1">{item.studentName} · {item.className}</p>
      <p className="text-[11px] text-muted mt-1">Início: {item.createdAt}{item.updatedAt ? ` · Última atualização: ${item.updatedAt}` : ''}</p>
      <p className="text-[11px] mt-2 px-2 py-1 inline-block rounded-full bg-gbg text-gd border border-gp">{formatStatus(item.status)}</p>

      <DetailBlock title="Observação inicial" text={item.observationInitial} />

      {item.chosenIntervention && (
        <>
          <DetailBlock title="Objetivo pedagógico" text={item.chosenIntervention.objective} />
          <DetailBlock title="Como foi aplicada" text={item.chosenIntervention.howToApply} />
          <DetailBlock title="O que observar" text={item.chosenIntervention.whatToObserve} />
        </>
      )}

      {item.teacherReturn && <DetailBlock title="Retorno da professora" text={item.teacherReturn} />}
      {item.returnChoice && (
        <p className="text-[11px] text-muted mt-3">
          Resultado informado:
          {' '}
          <strong>{formatReturnChoiceLabel(item.returnChoice)}</strong>
        </p>
      )}
      {item.aiAnalysis && <DetailBlock title="Análise da IA" text={item.aiAnalysis} />}
      {item.evolutionRecord && <DetailBlock title="Registro de evolução" text={item.evolutionRecord} />}

      {timeline.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Linha do tempo</p>
          <div className="flex flex-col gap-2">
            {timeline.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="rounded-app-sm border border-border bg-cream px-3 py-2">
                <p className="text-[11px] font-bold text-ink">{entry.label}</p>
                <p className="text-[10px] text-muted mt-0.5">{formatTimelineDate(entry.at)}</p>
                {entry.teacherReturn && <p className="text-[11px] text-soft mt-1 leading-[1.5]">{entry.teacherReturn}</p>}
                {entry.aiAnalysis && <p className="text-[11px] text-soft mt-1 leading-[1.5] whitespace-pre-wrap">{entry.aiAnalysis}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {item.status !== 'concluida' && (
        <div className="grid grid-cols-1 gap-2 mt-4">
          <button onClick={onResume} disabled={!item.chosenIntervention} className="py-3 rounded-app-sm bg-gd text-white text-[12px] font-bold disabled:opacity-50">
            Retomar retorno da professora
          </button>
          <button onClick={onComplete} className="py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[12px] font-bold">
            Concluir intervenção
          </button>
          <button onClick={onRemove} className="py-3 rounded-app-sm border border-red-200 bg-red-50 text-red-700 text-[12px] font-bold">
            Remover do histórico
          </button>
        </div>
      )}
    </div>
  )
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold text-muted">{title}</p>
      <p className="text-[12px] text-ink mt-1 leading-[1.6] whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function ChoiceOption({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-app-sm border px-3 py-3 text-left text-[13px] font-bold ${
        selected ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'
      }`}
    >
      {label}
    </button>
  )
}

function buildInterventionTimeline(item: InterventionHistoryItem): InterventionActivityEntry[] {
  if (item.activityLog?.length) return item.activityLog
  const fallback: InterventionActivityEntry[] = [{
    at: item.createdAt,
    type: 'created',
    label: 'Intervenção iniciada',
  }]
  if (item.chosenIntervention) {
    fallback.push({
      at: item.createdAt,
      type: 'chosen',
      label: `Intervenção escolhida: ${item.chosenIntervention.title}`,
      chosenIntervention: item.chosenIntervention,
    })
  }
  if (item.teacherReturn) {
    fallback.push({
      at: item.updatedAt ?? item.createdAt,
      type: 'return',
      label: 'Retorno da professora registrado',
      teacherReturn: item.teacherReturn,
      returnChoice: item.returnChoice,
    })
  }
  if (item.aiAnalysis) {
    fallback.push({
      at: item.updatedAt ?? item.createdAt,
      type: 'analysis',
      label: item.returnChoice ? formatReturnChoiceLabel(item.returnChoice) : 'Análise pedagógica',
      aiAnalysis: item.aiAnalysis,
      evolutionRecord: item.evolutionRecord,
      returnChoice: item.returnChoice,
    })
  }
  if (item.status === 'concluida') {
    fallback.push({
      at: item.updatedAt ?? item.createdAt,
      type: 'concluded',
      label: 'Intervenção concluída',
    })
  }
  return fallback
}

function parseInterventionSuggestions(rawText: string) {
  const parsed = tryParseJson(rawText) as { suggestions?: Array<Record<string, unknown>> } | null
  const fromJson = parsed?.suggestions?.map((item, index) => mapSuggestion(item, index)).filter(Boolean) as InterventionSuggestion[] | undefined
  if (fromJson && fromJson.length >= 3) return fromJson.slice(0, 5)
  return []
}

function parseInterventionFeedback(rawText: string) {
  const parsed = tryParseJson(rawText) as {
    analysisText?: string
    evolutionRecord?: string
    recommendedSuggestions?: Array<Record<string, unknown>>
  } | null

  const recommendedSuggestions = (parsed?.recommendedSuggestions ?? [])
    .slice(0, 4)
    .map((item, index) => mapSuggestion(item, index))
    .filter(Boolean) as InterventionSuggestion[]

  return {
    analysisText: parsed?.analysisText?.trim() || rawText.trim(),
    evolutionRecord: parsed?.evolutionRecord?.trim() || '',
    recommendedSuggestions,
  }
}

function mapSuggestion(item: Record<string, unknown>, index: number): InterventionSuggestion | null {
  const title = asText(item.title)
  const objective = asText(item.objective)
  const howToApply = asText(item.howToApply)
  const whatToObserve = asText(item.whatToObserve)
  const recordText = asText(item.recordText)
  const summary = asText(item.summary) || objective
  if (!title || !objective || !howToApply || !whatToObserve || !recordText) return null
  return {
    id: `sg-${Date.now()}-${index}`,
    title,
    summary,
    objective,
    howToApply,
    whatToObserve,
    recordText,
  }
}

function tryParseJson(rawText: string) {
  try {
    return JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatStatus(status: InterventionHistoryItem['status']) {
  if (status === 'pendente') return 'Pendente'
  if (status === 'em_acompanhamento') return 'Em acompanhamento'
  if (status === 'descartada') return 'Descartada'
  return 'Concluída'
}

function formatReturnChoiceLabel(choice: InterventionReturnChoice) {
  if (choice === 'houve_avanco') return 'Houve avanço'
  if (choice === 'houve_avanco_parcial') return 'Houve avanço parcial'
  return 'Ainda necessita acompanhamento'
}

function formatTimelineDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseHistoryDate(value: string) {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}
