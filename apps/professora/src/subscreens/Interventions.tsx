import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { formatAiUsageMessage, generateAiTextDocument } from '@/services/ai-usage'
import type {
  InterventionHistoryItem,
  InterventionReturnChoice,
  InterventionSuggestion,
} from '@/types'

type Step = 'form' | 'suggestions' | 'chosen' | 'feedback' | 'analysis'

export default function InterventionsSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeStudentId, interventions, addIntervention, updateIntervention, addAnnotation } = useAppStore()

  const allStudents = useMemo(
    () => classes.flatMap((classData) => classData.students.map((student) => ({ ...student, classId: classData.id, className: classData.name }))),
    [classes],
  )
  const [selectedStudentId, setSelectedStudentId] = useState(activeStudentId ?? allStudents[0]?.id ?? '')
  const selectedStudent = allStudents.find((student) => student.id === selectedStudentId) ?? allStudents[0]
  const [observation, setObservation] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [generating, setGenerating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [usageMessage, setUsageMessage] = useState('')
  const [suggestions, setSuggestions] = useState<InterventionSuggestion[]>([])
  const [chosenSuggestion, setChosenSuggestion] = useState<InterventionSuggestion | null>(null)
  const [teacherReturn, setTeacherReturn] = useState('')
  const [returnChoice, setReturnChoice] = useState<InterventionReturnChoice>('houve_avanco')
  const [analysisText, setAnalysisText] = useState('')
  const [followupSuggestions, setFollowupSuggestions] = useState<InterventionSuggestion[]>([])
  const [activeInterventionId, setActiveInterventionId] = useState('')

  const studentHistory = useMemo(
    () => interventions.filter((item) => item.studentId === selectedStudent?.id),
    [interventions, selectedStudent?.id],
  )

  useEffect(() => {
    setStep('form')
    setObservation('')
    setError('')
    setUsageMessage('')
    setSuggestions([])
    setChosenSuggestion(null)
    setTeacherReturn('')
    setAnalysisText('')
    setFollowupSuggestions([])
    setActiveInterventionId('')
    setReturnChoice('houve_avanco')
  }, [selectedStudentId])

  async function handleGenerateSuggestions() {
    if (!selectedStudent || observation.trim().length < 12) return

    setGenerating(true)
    setError('')
    setUsageMessage('')
    setSuggestions([])
    setChosenSuggestion(null)
    setFollowupSuggestions([])
    setAnalysisText('')

    try {
      const result = await generateAiTextDocument({
        generationType: 'other',
        classId: selectedStudent.classId,
        studentId: selectedStudent.id,
        promptVersion: 'interventions-v1',
        requestSummary: {
          interventionMode: 'suggestions',
          studentName: selectedStudent.name,
          studentAge: `${selectedStudent.age} anos${selectedStudent.ageMonths ? ` e ${selectedStudent.ageMonths} meses` : ''}`,
          className: selectedStudent.className,
          observation,
        },
      })

      if (!result.allowed || !result.generatedText) {
        setError(result.message || 'Nao foi possivel gerar sugestoes agora.')
        return
      }

      const parsedSuggestions = parseInterventionSuggestions(result.generatedText)
      setSuggestions(parsedSuggestions)
      setUsageMessage(formatAiUsageMessage(result))
      setStep('suggestions')
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Nao foi possivel gerar sugestoes agora.')
    } finally {
      setGenerating(false)
    }
  }

  function chooseIntervention(suggestion: InterventionSuggestion) {
    setChosenSuggestion(suggestion)
    setStep('chosen')
    setActiveInterventionId(`int-${Date.now()}`)
  }

  function closeWithoutRegistering() {
    if (!selectedStudent || !chosenSuggestion || !activeInterventionId) {
      closeSubscreen()
      return
    }

    const item: InterventionHistoryItem = {
      id: activeInterventionId,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      classId: selectedStudent.classId,
      className: selectedStudent.className,
      createdAt: new Date().toISOString(),
      observationInitial: observation.trim(),
      suggestions,
      chosenIntervention: chosenSuggestion,
      status: 'pendente',
    }
    upsertIntervention(item)
    closeSubscreen()
  }

  async function handleAnalyzeReturn() {
    if (!selectedStudent || !chosenSuggestion || teacherReturn.trim().length < 8) return

    setAnalyzing(true)
    setError('')
    setUsageMessage('')

    try {
      const result = await generateAiTextDocument({
        generationType: 'other',
        classId: selectedStudent.classId,
        studentId: selectedStudent.id,
        promptVersion: 'interventions-feedback-v1',
        requestSummary: {
          interventionMode: 'feedback_analysis',
          studentName: selectedStudent.name,
          observationInitial: observation,
          interventionChosen: chosenSuggestion,
          teacherReturn,
          returnChoice,
        },
      })

      if (!result.allowed || !result.generatedText) {
        setError(result.message || 'Nao foi possivel analisar o retorno agora.')
        return
      }

      const parsed = parseInterventionFeedback(result.generatedText)
      const status = returnChoice === 'houve_avanco' ? 'concluida' : 'em_acompanhamento'
      const itemId = activeInterventionId || `int-${Date.now()}`
      const item: InterventionHistoryItem = {
        id: itemId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        classId: selectedStudent.classId,
        className: selectedStudent.className,
        createdAt: new Date().toISOString(),
        observationInitial: observation.trim(),
        suggestions,
        chosenIntervention: chosenSuggestion,
        teacherReturn: teacherReturn.trim(),
        returnChoice,
        aiAnalysis: parsed.analysisText,
        evolutionRecord: parsed.evolutionRecord,
        status,
      }

      upsertIntervention(item)

      if (returnChoice === 'houve_avanco') {
        addAnnotation({
          id: `ann-int-${Date.now()}`,
          category: 'evolucao',
          label: 'Evolucao de intervencao',
          badgeClass: 'badge-ev',
          studentName: selectedStudent.name,
          text: parsed.evolutionRecord || parsed.analysisText,
          date: 'Agora',
          classId: selectedStudent.classId,
          studentId: selectedStudent.id,
          tags: ['Intervencao', 'Houve avanco'],
          persistence: ['observacao-continua', 'evolucao-positiva'],
        })
      }

      setAnalysisText(parsed.analysisText)
      setFollowupSuggestions(returnChoice === 'houve_avanco' ? [] : parsed.recommendedSuggestions)
      setUsageMessage(formatAiUsageMessage(result))
      setStep('analysis')
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Nao foi possivel analisar o retorno agora.')
    } finally {
      setAnalyzing(false)
    }
  }

  function upsertIntervention(item: InterventionHistoryItem) {
    const exists = interventions.some((current) => current.id === item.id)
    if (exists) {
      updateIntervention(item)
    } else {
      addIntervention(item)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Intervencoes</span>
      </div>

      <div className="scroll-area px-[18px] py-4">
        {!selectedStudent && (
          <div className="bg-white rounded-app border border-border shadow-card p-4">
            <p className="text-[13px] font-bold text-ink">Nenhuma crianca encontrada</p>
            <p className="text-[12px] text-muted mt-1 leading-[1.6]">
              Cadastre uma crianca em Turmas para iniciar as intervencoes pedagogicas.
            </p>
          </div>
        )}

        {step === 'form' && (
          <>
            <div className="bg-white rounded-app border border-border shadow-card p-4 mb-4">
              <p className="text-[13px] text-soft leading-[1.6]">
                Registre uma observacao sobre a crianca e receba sugestoes pedagogicas personalizadas.
              </p>
            </div>

            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Aluno</label>
            <select
              className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              {allStudents.map((student) => (
                <option key={student.id} value={student.id}>{student.name} - {student.className}</option>
              ))}
            </select>

            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Observacao da professora</label>
            <textarea
              className="w-full min-h-[160px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
              placeholder="Descreva o que foi observado na rotina da crianca..."
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
            />

            <button
              onClick={handleGenerateSuggestions}
              disabled={!selectedStudent || generating || observation.trim().length < 12}
              className="w-full mt-4 py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? <><div className="spinner !w-5 !h-5" /> Gerando...</> : <><Sparkles size={17} /> Gerar sugestoes</>}
            </button>
          </>
        )}

        {step === 'suggestions' && (
          <>
            <p className="text-[13px] text-muted mb-3">Selecione uma estrategia para aplicar com a crianca.</p>
            <div className="flex flex-col gap-3">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-white rounded-app border border-border shadow-card p-4">
                  <p className="text-[13px] font-bold text-gd">{suggestion.title}</p>
                  <p className="text-[12px] text-muted mt-1 leading-[1.5]">{suggestion.summary}</p>
                  <p className="text-[12px] text-ink mt-2"><strong>Objetivo:</strong> {suggestion.objective}</p>
                  <button
                    onClick={() => chooseIntervention(suggestion)}
                    className="w-full mt-3 py-3 rounded-app-sm border border-gp bg-gbg text-gd text-[12px] font-bold"
                  >
                    Escolher esta intervencao
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
            <p className="text-[12px] text-ink mt-3"><strong>Observacao inicial:</strong> {observation}</p>
            <p className="text-[12px] text-ink mt-3"><strong>Objetivo pedagogico:</strong> {chosenSuggestion.objective}</p>
            <p className="text-[12px] text-ink mt-3"><strong>Como aplicar:</strong> {chosenSuggestion.howToApply}</p>
            <p className="text-[12px] text-ink mt-3"><strong>O que observar:</strong> {chosenSuggestion.whatToObserve}</p>
            <p className="text-[12px] text-ink mt-3"><strong>Texto para registro:</strong> {chosenSuggestion.recordText}</p>

            <button
              onClick={() => setStep('feedback')}
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
          </div>
        )}

        {step === 'feedback' && (
          <div className="bg-white rounded-app border border-border shadow-card p-4">
            <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Retorno da professora</label>
            <textarea
              className="w-full min-h-[130px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
              value={teacherReturn}
              onChange={(event) => setTeacherReturn(event.target.value)}
              placeholder="Descreva o que foi feito, como a crianca reagiu e os resultados observados."
            />

            <div className="mt-3 flex flex-col gap-2">
              <ChoiceOption
                selected={returnChoice === 'houve_avanco'}
                label="Houve avanco"
                onClick={() => setReturnChoice('houve_avanco')}
              />
              <ChoiceOption
                selected={returnChoice === 'houve_avanco_parcial'}
                label="Houve avanco parcial"
                onClick={() => setReturnChoice('houve_avanco_parcial')}
              />
              <ChoiceOption
                selected={returnChoice === 'necessita_acompanhamento'}
                label="Ainda necessita acompanhamento"
                onClick={() => setReturnChoice('necessita_acompanhamento')}
              />
            </div>

            <button
              onClick={handleAnalyzeReturn}
              disabled={!selectedStudent || analyzing || teacherReturn.trim().length < 8}
              className="w-full mt-4 py-3 rounded-app-sm bg-gd text-white text-[13px] font-bold border-none disabled:opacity-50"
            >
              {analyzing ? 'Analisando...' : 'Analisar retorno'}
            </button>
          </div>
        )}

        {step === 'analysis' && (
          <div className="bg-white rounded-app border border-border shadow-card p-4">
            <p className="text-[14px] font-bold text-gd mb-2">Analise pedagogica</p>
            <p className="text-[12px] text-soft leading-[1.6] whitespace-pre-wrap">{analysisText}</p>
            {returnChoice === 'houve_avanco' && (
              <p className="mt-3 text-[12px] font-bold text-gd">Evolucao registrada com sucesso.</p>
            )}

            {followupSuggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-[12px] font-bold text-ink mb-2">Novas estrategias sugeridas</p>
                <div className="flex flex-col gap-2">
                  {followupSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="rounded-app-sm border border-border bg-cream p-3">
                      <p className="text-[12px] font-bold text-gd">{suggestion.title}</p>
                      <p className="text-[11px] text-muted mt-1">{suggestion.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={closeSubscreen}
              className="w-full mt-4 py-3 rounded-app-sm bg-gd text-white text-[13px] font-bold border-none"
            >
              Concluir
            </button>
          </div>
        )}

        {(error || usageMessage) && (
          <p className={`mt-3 rounded-app-sm border px-3 py-2 text-[12px] leading-[1.5] ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-gp bg-gbg text-gd'
          }`}>
            {error || usageMessage}
          </p>
        )}

        {studentHistory.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Historico da crianca</p>
            <div className="flex flex-col gap-2 pb-8">
              {studentHistory.map((item) => (
                <div key={item.id} className="bg-white rounded-app-sm border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-ink">{item.chosenIntervention?.title ?? 'Intervencao pendente'}</p>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-gbg text-gd border border-gp">
                      {formatStatus(item.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">{item.observationInitial}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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

function parseInterventionSuggestions(rawText: string) {
  const parsed = tryParseJson(rawText) as { suggestions?: Array<Record<string, unknown>> } | null
  const fromJson = parsed?.suggestions?.map((item, index) => mapSuggestion(item, index)).filter(Boolean) as InterventionSuggestion[] | undefined
  if (fromJson && fromJson.length >= 3) {
    return fromJson.slice(0, 5)
  }

  return [0, 1, 2].map((index) => ({
    id: `sg-fallback-${index}`,
    title: `Intervencao pedagogica ${index + 1}`,
    summary: 'Sugere-se uma estrategia gradual com acolhimento, rotina previsivel e mediacao docente.',
    objective: 'Apoiar o desenvolvimento da crianca com intencionalidade pedagogica.',
    howToApply: 'Aplicar em pequenos momentos da rotina, com orientacoes claras e reforco positivo.',
    whatToObserve: 'Participacao, interacoes, autonomia e resposta emocional da crianca.',
    recordText: 'Observou-se participacao progressiva com necessidade de continuidade do acompanhamento.',
  }))
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

  const fallbackSuggestions: InterventionSuggestion[] = [
    {
      id: `sg-feedback-${Date.now()}-0`,
      title: 'Ajuste de mediacao na rotina',
      summary: 'Recomenda-se ajustar a mediacao com orientacoes curtas e previsiveis.',
      objective: 'Favorecer maior participacao e seguranca da crianca nas propostas.',
      howToApply: 'Retomar a atividade em etapas pequenas, com modelagem e tempo de resposta.',
      whatToObserve: 'Engajamento progressivo, autonomia e interacao com colegas.',
      recordText: 'Observou-se necessidade de continuidade com ajuste de mediacao pedagogica.',
    },
    {
      id: `sg-feedback-${Date.now()}-1`,
      title: 'Continuidade com variacao de estrategia',
      summary: 'Sugere-se manter a intencao pedagogica variando materiais e organizacao.',
      objective: 'Ampliar oportunidades de resposta positiva da crianca.',
      howToApply: 'Alternar recursos concretos, duplas e momentos de acolhimento breve.',
      whatToObserve: 'Resposta emocional, participacao e comunicacao durante a atividade.',
      recordText: 'Recomenda-se continuidade do acompanhamento pedagogico com variacao de estrategia.',
    },
  ]

  return {
    analysisText: parsed?.analysisText?.trim() || rawText.trim(),
    evolutionRecord: parsed?.evolutionRecord?.trim() || '',
    recommendedSuggestions: recommendedSuggestions.length > 0 ? recommendedSuggestions : fallbackSuggestions,
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
  return 'Concluida'
}
