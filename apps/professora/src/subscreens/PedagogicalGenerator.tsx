import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { formatAiUsageMessage, generateAiTextDocument } from '@/services/ai-usage'
import { updateReport } from '@/services/reports'
import { listSupportMaterials, type SupportMaterial } from '@/services/materials'
import { celebrateAiGeneration } from '@/utils/celebration'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import { loadDocumentStyleSettings } from '@/utils/document-style'
import GenerationDocumentLoadingScreen from '@/components/ui/GenerationDocumentLoadingScreen'

interface PedagogicalGeneratorProps {
  data?: unknown
}

type PlanningPeriod = 'diario' | 'semanal'

const RIGHTS = [
  'Conviver',
  'Brincar',
  'Participar',
  'Explorar',
  'Expressar',
  'Conhecer-se',
]

const BNCC_FIELDS = [
  'O eu, o outro e o nos',
  'Corpo, gestos e movimentos',
  'Tracos, sons, cores e formas',
  'Escuta, fala, pensamento e imaginacao',
  'Espacos, tempos, quantidades, relacoes e transformacoes',
]

const DURATIONS = ['15 dias', '1 mes', '2 meses', 'Bimestre', 'Semestre']
const ASSESSMENT_OPTIONS = ['Observacao', 'Fotos', 'Portfolio', 'Roda de conversa', 'Registros escritos']

export default function PedagogicalGeneratorSubscreen({ data }: PedagogicalGeneratorProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, userId } = useAppStore()
  const docKind = typeof data === 'object' && data && 'docKind' in data
    ? String((data as { docKind?: string }).docKind)
    : 'Planejamento (Diário ou Semanal)'
  const normalizedDocKind = normalizeText(docKind)
  const isProject = normalizedDocKind.includes('projeto pedagogico')
  const title = isProject ? 'Projeto Pedagógico' : 'Planejamento'

  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '')
  const [planningPeriod, setPlanningPeriod] = useState<PlanningPeriod>('semanal')
  const [theme, setTheme] = useState('')
  const [rights, setRights] = useState<string[]>([])
  const [objective, setObjective] = useState('')
  const [resources, setResources] = useState('')
  const [duration, setDuration] = useState('')
  const [justification, setJustification] = useState('')
  const [bnccFields, setBnccFields] = useState<string[]>([])
  const [methodology, setMethodology] = useState('')
  const [assessment, setAssessment] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [savedContent, setSavedContent] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [reportId, setReportId] = useState('')
  const [editingDocument, setEditingDocument] = useState(false)
  const [savingDocument, setSavingDocument] = useState(false)
  const [usageMessage, setUsageMessage] = useState('')
  const [usageError, setUsageError] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [supportMaterials, setSupportMaterials] = useState<SupportMaterial[]>([])
  const [selectedSupportMaterialIds, setSelectedSupportMaterialIds] = useState<string[]>([])
  const [loadingSupportMaterials, setLoadingSupportMaterials] = useState(false)
  const loadedDraftRef = useRef(false)
  const draftKey = `approf:draft:planning:${userId}:${docKind}`

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? classes[0]
  const selectedClassName = selectedClass?.name ?? ''
  const selectedSupportMaterials = supportMaterials.filter((material) => selectedSupportMaterialIds.includes(material.id))

  const canGenerate = isProject
    ? Boolean(
        selectedClassId
        && theme.trim().length >= 3
        && duration.trim()
        && justification.trim().length >= 20
        && bnccFields.length
        && objective.trim().length >= 4
        && rights.length
        && methodology.trim().length >= 20
        && resources.trim().length >= 3
        && assessment.length,
      )
    : Boolean(
        selectedClassId
        && theme.trim().length >= 3
        && rights.length
        && objective.trim().length >= 4
        && resources.trim().length >= 3,
      )

  const generationRequirementHint = getRequirementHint({
    isProject,
    theme,
    objective,
    resources,
    duration,
    justification,
    methodology,
    rightsCount: rights.length,
    bnccCount: bnccFields.length,
    assessmentCount: assessment.length,
  })
  const generationViewKey = generated ? 'result' : generating ? 'loading' : 'form'

  useEffect(() => {
    if (loadedDraftRef.current) return
    const draft = loadDraft<{
      selectedClassId: string
      planningPeriod: PlanningPeriod
      theme: string
      rights: string[]
      objective: string
      resources: string
      duration: string
      justification: string
      bnccFields: string[]
      methodology: string
      assessment: string[]
    }>(draftKey)
    if (draft) {
      setSelectedClassId(draft.selectedClassId || classes[0]?.id || '')
      setPlanningPeriod(draft.planningPeriod || 'semanal')
      setTheme(draft.theme || '')
      setRights(draft.rights ?? [])
      setObjective(draft.objective || '')
      setResources(draft.resources || '')
      setDuration(draft.duration || '')
      setJustification(draft.justification || '')
      setBnccFields(draft.bnccFields ?? [])
      setMethodology(draft.methodology || '')
      setAssessment(draft.assessment ?? [])
      setDraftMessage('Rascunho recuperado')
    }
    loadedDraftRef.current = true
  }, [classes, draftKey])

  useEffect(() => {
    if (!loadedDraftRef.current) return
    if (generated || generating) return
    const timeout = window.setTimeout(() => {
      saveDraft(draftKey, {
        selectedClassId,
        planningPeriod,
        theme,
        rights,
        objective,
        resources,
        duration,
        justification,
        bnccFields,
        methodology,
        assessment,
      })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [
    assessment,
    bnccFields,
    draftKey,
    duration,
    generated,
    generating,
    justification,
    methodology,
    objective,
    planningPeriod,
    resources,
    rights,
    selectedClassId,
    theme,
  ])

  useEffect(() => {
    if (!draftMessage) return
    const timeout = window.setTimeout(() => setDraftMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [draftMessage])

  useEffect(() => {
    let active = true
    setLoadingSupportMaterials(true)
    listSupportMaterials()
      .then((items) => {
        if (!active) return
        setSupportMaterials(items)
      })
      .catch(() => {
        if (!active) return
        setSupportMaterials([])
      })
      .finally(() => {
        if (active) setLoadingSupportMaterials(false)
      })
    return () => {
      active = false
    }
  }, [])

  function toggleValue(value: string, setter: (next: string[]) => void, current: string[]) {
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    setter(next)
  }

  function toggleSupportMaterial(id: string) {
    setSelectedSupportMaterialIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function generate() {
    if (!canGenerate) return
    setUsageError('')
    setUsageMessage('')
    setGenerating(true)
    setSavedContent('')
    setEditableContent('')
    setReportId('')
    setEditingDocument(false)

    try {
      const styleSettings = loadDocumentStyleSettings()
      const materialExampleContext = formatSupportMaterialExamples(selectedSupportMaterials)
      const generationType = isProject
        ? 'pedagogical_project'
        : planningPeriod === 'diario'
          ? 'daily_lesson_plan'
          : 'weekly_planning'
      const result = await generateAiTextDocument({
        generationType,
        classId: selectedClass?.id ?? null,
        promptVersion: isProject ? 'projeto-pedagogico-v2' : 'planejamento-v2',
        requestSummary: {
          docKind: isProject ? 'Projeto Pedagógico' : 'Planejamento',
          planningPeriod,
          className: selectedClassName,
          ageGroup: selectedClass?.ageGroup ?? null,
          theme,
          intentionality: rights,
          direitosAprendizagem: rights,
          objective,
          bnccCodes: objective,
          resources,
          duration,
          justification,
          bnccFields,
          methodology,
          assessment,
          avaliacaoRegistro: assessment.join(', '),
          extraContext: materialExampleContext || null,
          materialExamples: selectedSupportMaterials.map((material) => ({
            title: material.title,
            description: material.description,
            category: material.detected_category,
            preview: material.content_preview,
          })),
          documentStyle: styleSettings,
        },
      })

      if (!result.allowed) {
        setUsageError(result.message || 'Esta geração precisa de pacote extra.')
        setGenerating(false)
        return
      }

      setUsageMessage(formatAiUsageMessage(result))
      const generatedBody = result.generatedText || preview
      setSavedContent(generatedBody)
      setEditableContent(generatedBody)
      setReportId(result.reportId ?? '')
      window.setTimeout(() => {
        celebrateAiGeneration()
        setGenerating(false)
        setGenerated(true)
      }, 800)
      clearDraft(draftKey)
      resetPlanningFormAfterGeneration()
    } catch (error) {
      setGenerating(false)
      setUsageError(error instanceof Error ? error.message : 'Não foi possível gerar agora.')
    }
  }

  function resetPlanningFormAfterGeneration() {
    setPlanningPeriod('semanal')
    setTheme('')
    setRights([])
    setObjective('')
    setResources('')
    setDuration('')
    setJustification('')
    setBnccFields([])
    setMethodology('')
    setAssessment([])
    setSelectedSupportMaterialIds([])
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

  const preview = createPreview({
    isProject,
    planningPeriod,
    selectedClassName,
    theme,
    rights,
    objective,
    resources,
    duration,
    justification,
    bnccFields,
    methodology,
    assessment,
  })

  function handleBack() {
    if (generated && editingDocument && editableContent !== savedContent) {
      const discard = window.confirm('Você tem alterações não salvas. Deseja sair sem salvar?')
      if (!discard) return
    }
    closeSubscreen()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={handleBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">{title}</span>
          <span className="text-[11px] text-muted">
            {isProject ? 'Projeto pedagógico com todos os campos obrigatórios.' : 'Escolha diário ou semanal e preencha os campos do planejamento.'}
          </span>
        </div>
      </div>

      <div key={generationViewKey} className="scroll-area px-[18px] stage-fade-in">
        {!generated ? (
          generating ? (
            <GenerationDocumentLoadingScreen variant="planning" />
          ) : (
            <div className="py-5">
              <IntroCard isProject={isProject} />

              <FieldLabel>Turma</FieldLabel>
              <select
                className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>

              {!isProject ? (
                <>
                  <FieldLabel>Escolha</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
                    <button
                      onClick={() => setPlanningPeriod('diario')}
                      className={`rounded-app-sm border px-3 py-3 text-left ${planningPeriod === 'diario' ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
                    >
                      <span className="block text-[13px] font-bold">Diário</span>
                      <span className="block text-[11px] mt-1">Plano para um dia</span>
                    </button>
                    <button
                      onClick={() => setPlanningPeriod('semanal')}
                      className={`rounded-app-sm border px-3 py-3 text-left ${planningPeriod === 'semanal' ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
                    >
                      <span className="block text-[13px] font-bold">Semanal</span>
                      <span className="block text-[11px] mt-1">Planejamento da semana</span>
                    </button>
                  </div>

                  <TextInput
                    label="Tema"
                    value={theme}
                    onChange={setTheme}
                    placeholder="Ex: Animais da fazenda, Cores e misturas, Minha família..."
                  />

                  <Checklist
                    label="Intencionalidade"
                    hint="Quais direitos serão o foco do planejamento."
                    options={RIGHTS}
                    selected={rights}
                    onToggle={(value) => toggleValue(value, setRights, rights)}
                  />

                  <TextArea
                    label="Objetivos"
                    value={objective}
                    onChange={setObjective}
                    placeholder="Liste os códigos BNCC que serão trabalhados. Ex: EI02EF01, EI03ET01, EI02CG02..."
                    rows={3}
                  />

                  <TextArea
                    label="Recursos"
                    value={resources}
                    onChange={setResources}
                    placeholder="Materiais que precisam ser providenciados para a semana. Ex: tinta guache, papel A3, rolos de papelão, livros, brinquedos..."
                    rows={4}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    label="Tema"
                    value={theme}
                    onChange={setTheme}
                    placeholder="O título ou assunto do projeto. Ex: Horta Escolar, Água e Vida, O Mundo dos Insetos..."
                  />

                  <FieldLabel>Duração</FieldLabel>
                  <select
                    className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  >
                    <option value="">Selecione a duração</option>
                    {DURATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>

                  <TextArea
                    label="Justificativa"
                    value={justification}
                    onChange={setJustification}
                    placeholder="Explique o porquê de realizar esse projeto agora e indique quais campos da BNCC serão trabalhados."
                    rows={4}
                  />

                  <Checklist
                    label="Campos da BNCC"
                    hint="Selecione os campos que aparecem na justificativa do projeto."
                    options={BNCC_FIELDS}
                    selected={bnccFields}
                    onToggle={(value) => toggleValue(value, setBnccFields, bnccFields)}
                  />

                  <TextArea
                    label="Objetivo geral"
                    value={objective}
                    onChange={setObjective}
                    placeholder="Informe os códigos da BNCC. Ex: EI03ET01, EI02EF03, EI03CG01..."
                    rows={3}
                  />

                  <Checklist
                    label="Objetivo específico"
                    hint="Indique quais direitos estão sendo garantidos."
                    options={RIGHTS}
                    selected={rights}
                    onToggle={(value) => toggleValue(value, setRights, rights)}
                  />

                  <TextArea
                    label="Metodologia"
                    value={methodology}
                    onChange={setMethodology}
                    placeholder="Descreva como será feito: o passo a passo, como o tema será apresentado, quais experiências serão propostas e como o projeto será encerrado."
                    rows={5}
                  />

                  <TextArea
                    label="Recursos"
                    value={resources}
                    onChange={setResources}
                    placeholder="Materiais necessários. Ex: sementes, terra, vasos, regadores, lupas, livros, tintas, papéis diversos..."
                    rows={4}
                  />

                  <Checklist
                    label="Avaliação"
                    hint="Como será registrado o processo."
                    options={ASSESSMENT_OPTIONS}
                    selected={assessment}
                    onToggle={(value) => toggleValue(value, setAssessment, assessment)}
                  />
                </>
              )}

              <SupportMaterialPicker
                materials={supportMaterials}
                selectedIds={selectedSupportMaterialIds}
                loading={loadingSupportMaterials}
                onToggle={toggleSupportMaterial}
              />

              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <><Sparkles size={18} /> Gerar documento</>
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
              {draftMessage && <p className="mt-2 text-[12px] text-gm">{draftMessage}</p>}
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
              {editingDocument ? (
                <textarea
                  className="w-full min-h-[520px] resize-y bg-white rounded-app-sm border border-border px-5 py-5 text-[14px] text-ink outline-none leading-[1.8] font-serif shadow-inner"
                  value={editableContent}
                  onChange={(event) => setEditableContent(event.target.value)}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[12px] text-ink leading-[1.7]">{editableContent || savedContent || preview}</pre>
              )}
            </div>

            <button
              onClick={() => openSubscreen('documents', { focusReportId: reportId })}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2"
            >
              Meus documentos
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
              onClick={() => exportAbntDocument(editableContent || savedContent || preview, title)}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2"
            >
              Exportar documento ABNT
            </button>

            <button onClick={archiveDocument} className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold mb-2">
              Arquivar
            </button>

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

function IntroCard({ isProject }: { isProject: boolean }) {
  return (
    <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[14px] bg-gbg border border-gp flex items-center justify-center">
          <Sparkles size={22} color="#4F8341" strokeWidth={1.7} />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-[20px] text-gd">Antes de gerar</h2>
          <p className="text-[12px] text-muted leading-snug">
            {isProject
              ? 'Preencha os campos do projeto pedagógico conforme sua estrutura.'
              : 'Preencha os campos do planejamento diário ou semanal.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">{children}</label>
}

function TextInput(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <>
      <FieldLabel>{props.label}</FieldLabel>
      <input
        className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </>
  )
}

function TextArea(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows: number
}) {
  return (
    <>
      <FieldLabel>{props.label}</FieldLabel>
      <textarea
        className="w-full resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none leading-[1.6]"
        style={{ minHeight: props.rows * 30 }}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </>
  )
}

function Checklist(props: {
  label: string
  hint: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="mb-4">
      <FieldLabel>{props.label}</FieldLabel>
      <p className="text-[12px] text-muted leading-[1.5] mt-1 mb-2">{props.hint}</p>
      <div className="flex flex-col gap-2">
        {props.options.map((item) => {
          const selected = props.selected.includes(item)
          return (
            <button
              key={item}
              onClick={() => props.onToggle(item)}
              className={`w-full rounded-app-sm border px-3 py-3 text-left text-[13px] font-bold ${
                selected ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'
              }`}
            >
              {selected ? '[x] ' : '[ ] '}
              {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SupportMaterialPicker(props: {
  materials: SupportMaterial[]
  selectedIds: string[]
  loading: boolean
  onToggle: (id: string) => void
}) {
  if (props.loading) {
    return (
      <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
        <p className="text-[13px] font-bold text-ink">Material de apoio como exemplo</p>
        <p className="text-[12px] text-muted mt-1">Carregando materiais aprovados...</p>
      </div>
    )
  }

  if (!props.materials.length) return null

  return (
    <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
      <p className="text-[13px] font-bold text-ink">Material de apoio como exemplo</p>
      <p className="text-[11px] text-muted leading-[1.5] mt-1 mb-3">
        Selecione materiais aprovados para a IA usar como referencia de estrutura, linguagem e ideias.
      </p>
      <div className="flex flex-col gap-2">
        {props.materials.slice(0, 8).map((material) => {
          const selected = props.selectedIds.includes(material.id)
          return (
            <button
              key={material.id}
              onClick={() => props.onToggle(material.id)}
              className={`w-full rounded-app-sm border px-3 py-3 text-left ${
                selected ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'
              }`}
            >
              <span className="block text-[12px] font-bold text-ink">{selected ? '[x] ' : '[ ] '}{material.title}</span>
              <span className="block text-[11px] mt-1">
                {material.description || material.content_preview || 'Material aprovado para referencia.'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatSupportMaterialExamples(materials: SupportMaterial[]) {
  if (!materials.length) return ''
  return [
    'MATERIAIS DE APOIO USADOS COMO REFERENCIA',
    '',
    ...materials.map((material, index) => [
      `${index + 1}. ${material.title}`,
      material.description ? `Descricao: ${material.description}` : '',
      material.detected_category ? `Categoria: ${material.detected_category}` : '',
      material.content_preview ? `Trecho seguro: ${material.content_preview.slice(0, 900)}` : '',
    ].filter(Boolean).join('\n')),
    '',
    'Use estes materiais apenas como referencia de estrutura, linguagem, ideias pedagogicas e exemplos. Nao copie dados pessoais e adapte ao formulario preenchido pela professora.',
  ].join('\n')
}

function createPreview(input: {
  isProject: boolean
  planningPeriod: PlanningPeriod
  selectedClassName: string
  theme: string
  rights: string[]
  objective: string
  resources: string
  duration: string
  justification: string
  bnccFields: string[]
  methodology: string
  assessment: string[]
}) {
  if (input.isProject) {
    return `PROJETO PEDAGOGICO
Turma: ${input.selectedClassName || '-'}

TEMA
${input.theme || '-'}

DURACAO
${input.duration || '-'}

JUSTIFICATIVA
${input.justification || '-'}
Campos da BNCC: ${input.bnccFields.join(', ') || '-'}

OBJETIVO GERAL
${input.objective || '-'}

OBJETIVO ESPECIFICO
Direitos garantidos: ${input.rights.join(', ') || '-'}

METODOLOGIA
${input.methodology || '-'}

RECURSOS
${input.resources || '-'}

AVALIACAO
${input.assessment.join(', ') || '-'}`
  }

  return `PLANEJAMENTO ${input.planningPeriod === 'diario' ? 'DIARIO' : 'SEMANAL'}
Turma: ${input.selectedClassName || '-'}

TEMA
${input.theme || '-'}

INTENCIONALIDADE
Direitos em foco: ${input.rights.join(', ') || '-'}

OBJETIVOS
${input.objective || '-'}

RECURSOS
${input.resources || '-'}`
}

function getRequirementHint(input: {
  isProject: boolean
  theme: string
  objective: string
  resources: string
  duration: string
  justification: string
  methodology: string
  rightsCount: number
  bnccCount: number
  assessmentCount: number
}) {
  if (input.theme.trim().length < 3) return 'Informe o tema do documento.'
  if (!input.rightsCount) return 'Selecione ao menos um direito de aprendizagem.'
  if (input.objective.trim().length < 4) return 'Informe os objetivos ou códigos BNCC.'
  if (input.resources.trim().length < 3) return 'Informe os recursos necessários.'
  if (!input.isProject) return ''
  if (!input.duration.trim()) return 'Selecione a duração do projeto.'
  if (input.justification.trim().length < 20) return 'Escreva a justificativa do projeto com mais detalhes.'
  if (!input.bnccCount) return 'Selecione ao menos um campo da BNCC.'
  if (input.methodology.trim().length < 20) return 'Descreva a metodologia com o passo a passo.'
  if (!input.assessmentCount) return 'Selecione como o processo será avaliado ou registrado.'
  return ''
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function exportAbntDocument(content: string, title: string) {
  const filename = normalizeText(title)
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
