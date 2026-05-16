import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, FileText, FileUp, Image, Sparkles, X } from 'lucide-react'
import { useNavStore, useAppStore } from '@/store'
import { formatAiUsageMessage, generateAiPortfolioImage, generateAiTextDocument, type AiGenerationType } from '@/services/ai-usage'
import { updateReport } from '@/services/reports'
import { celebrateAiGeneration } from '@/utils/celebration'
import type { Annotation } from '@/types'

const DIRECTION_SUGGESTIONS = [
  'Valorizar evolucoes recentes',
  'Usar tom mais acolhedor',
  'Trazer encaminhamentos para familia',
  'Destacar adaptacao e rotina',
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
type PortfolioOutput = 'text' | 'image'

export default function ReportSubscreen({ data }: ReportSubscreenProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes, activeStudentId, annotations } = useAppStore()

  const allStudents = useMemo(
    () => classes.flatMap((classData) => classData.students.map((student) => ({ ...student, classId: classData.id, className: classData.name }))),
    [classes],
  )
  const fallbackStudentId = activeStudentId ?? allStudents[0]?.id ?? ''
  const [selectedStudentId, setSelectedStudentId] = useState(fallbackStudentId)
  const selectedStudent = allStudents.find((student) => student.id === selectedStudentId) ?? allStudents[0]

  const reportKind = typeof data === 'object' && data && 'reportKind' in data
    ? String((data as { reportKind?: string }).reportKind)
    : 'Relatorio de desenvolvimento'

  const [mode, setMode] = useState<ReportMode>('annotations')
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [ignoredNotes, setIgnoredNotes] = useState('')
  const [blankContext, setBlankContext] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [attachments, setAttachments] = useState<ReportAttachment[]>([])
  const [portfolioOutput, setPortfolioOutput] = useState<PortfolioOutput>('text')
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const studentAnnotations = useMemo(
    () => annotations.filter((annotation) => matchesStudent(annotation, selectedStudentId, selectedStudent?.name)),
    [annotations, selectedStudentId, selectedStudent?.name],
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
  }, [selectedStudentId, studentAnnotations])

  const selectedAnnotations = studentAnnotations.filter((annotation) => selectedAnnotationIds.includes(annotation.id))
  const firstName = selectedStudent?.name.split(' ')[0] ?? 'A crianca'
  const isPortfolio = reportKind === 'Portfolio pedagogico'
  const canGenerate = mode === 'blank'
    ? blankContext.trim().length >= 20
    : Boolean(selectedStudent)

  const mockReport = createReportPreview({
    reportKind,
    studentName: selectedStudent?.name ?? '-',
    className: selectedStudent?.className ?? '-',
    firstName,
    mode,
    selectedAnnotations,
    ignoredNotes,
    blankContext,
    extraContext,
    attachments,
    portfolioOutput,
  })

  function handleBack() {
    if (generated && editingDocument && editableContent !== savedContent) {
      const discard = window.confirm('Voce tem alteracoes nao salvas. Deseja sair sem salvar?')
      if (!discard) return
    }
    closeSubscreen()
  }

  function addDirection(text: string) {
    setExtraContext((current) => current ? `${current}\n${text}.` : `${text}.`)
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
      const requestSummary = {
        reportKind,
        portfolioOutput,
        mode,
        studentName: selectedStudent?.name ?? null,
        className: selectedStudent?.className ?? null,
        selectedAnnotations: selectedAnnotations.map((annotation) => ({
          date: annotation.date,
          label: annotation.label,
          text: annotation.text,
        })),
        ignoredNotes,
        blankContext,
        extraContext,
        attachments: attachments.map((item) => ({
          name: item.name,
          type: item.type,
          size: item.size,
        })),
      }

      const generationType = getReportGenerationType(reportKind, portfolioOutput)
      const result = generationType === 'portfolio_image'
        ? await generateAiPortfolioImage({
            generationType,
            classId: selectedStudent?.classId ?? null,
            studentId: selectedStudent?.id ?? null,
            promptVersion: 'portfolio-image-v1',
            requestSummary,
          })
        : await generateAiTextDocument({
            generationType,
            classId: selectedStudent?.classId ?? null,
            studentId: selectedStudent?.id ?? null,
            promptVersion: 'professora-report-v1',
            requestSummary,
          })

      if (!result.allowed) {
        setUsageError(result.message || 'Esta geracao precisa de pacote extra.')
        setGenerating(false)
        return
      }

      setUsageMessage(formatAiUsageMessage(result))
      const generatedBody = 'generatedText' in result && result.generatedText
        ? result.generatedText
        : 'prompt' in result && result.prompt
          ? `Imagem de portfolio gerada com ChatGPT.\n\nPrompt usado:\n\n${result.prompt}`
          : mockReport
      setSavedContent(generatedBody)
      setEditableContent(generatedBody)
      setGeneratedImageUrl('imageDataUrl' in result && result.imageDataUrl ? result.imageDataUrl : '')
      setReportId(result.reportId ?? '')
      window.setTimeout(() => {
        celebrateAiGeneration()
        setGenerating(false)
        setGenerated(true)
      }, 900)
    } catch (error) {
      setGenerating(false)
      setUsageError(error instanceof Error ? error.message : 'Nao foi possivel gerar com IA.')
    }
  }

  async function saveDocument() {
    if (!reportId) {
      setUsageError('Documento ainda nao foi salvo no backend.')
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
      setUsageError(error instanceof Error ? error.message : 'Nao foi possivel salvar o documento.')
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
      setUsageError(error instanceof Error ? error.message : 'Nao foi possivel arquivar o documento.')
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

      <div className="scroll-area px-[18px]">
        {!generated ? (
          <div className="py-5">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-[14px] bg-gbg border border-gp flex items-center justify-center">
                  <Sparkles size={22} color="#4F8341" strokeWidth={1.7} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Antes de gerar</h2>
                  <p className="text-[12px] text-muted leading-snug">Escolha a crianca. Orientacoes extras e anexos sao opcionais.</p>
                </div>
              </div>

              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                Crianca
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
            </div>

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
                  <span className="block text-[13px] font-bold">Usar anotacoes</span>
                  <span className="block text-[11px] mt-1">Selecionar registros do app</span>
                </button>
                <button
                  onClick={() => setMode('blank')}
                  className={`rounded-app-sm border px-3 py-3 text-left ${
                    mode === 'blank' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">Comecar do zero</span>
                  <span className="block text-[11px] mt-1">Descrever tudo manualmente</span>
                </button>
              </div>
            </div>

            {isPortfolio && (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                  Tipo de portifolio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPortfolioOutput('text')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      portfolioOutput === 'text' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Texto com Claude</span>
                    <span className="block text-[11px] mt-1">Narrativa pedagogica e evidencias</span>
                  </button>
                  <button
                    onClick={() => setPortfolioOutput('image')}
                    className={`rounded-app-sm border px-3 py-3 text-left ${
                      portfolioOutput === 'image' ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                    }`}
                  >
                    <span className="block text-[13px] font-bold">Imagem com ChatGPT</span>
                    <span className="block text-[11px] mt-1">Capa ou painel visual</span>
                  </button>
                </div>
              </div>
            )}

            {mode === 'annotations' ? (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[13px] font-bold text-ink">Anotacoes de {firstName}</p>
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
                      Ainda nao ha anotacoes vinculadas a esta crianca. Voce pode comecar do zero ou incluir orientacoes abaixo.
                    </p>
                  )}
                </div>

                <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">
                  Desconsiderar algo
                </label>
                <textarea
                  className="w-full min-h-[86px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  placeholder="Ex: nao considerar a anotacao sobre choro da primeira semana, pois ja foi superado..."
                  value={ignoredNotes}
                  onChange={(event) => setIgnoredNotes(event.target.value)}
                />
              </div>
            ) : (
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                  Descricao completa para gerar do zero
                </label>
                <textarea
                  className="w-full min-h-[180px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                  placeholder="Descreva a rotina, evolucoes, pontos de atencao, interacoes, autonomia, linguagem, familia, encaminhamentos e o tom desejado para o documento..."
                  value={blankContext}
                  onChange={(event) => setBlankContext(event.target.value)}
                />
              </div>
            )}

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                Orientacao para a IA
              </label>
              <textarea
                className="w-full min-h-[118px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                placeholder="Ex: destacar a adaptacao nas ultimas semanas, evitar linguagem muito tecnica, incluir encaminhamentos para a familia..."
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-none mt-3 pb-1">
                {DIRECTION_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => addDirection(item)}
                    className="px-3 py-2 rounded-full text-xs font-bold border border-border bg-white text-muted whitespace-nowrap"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-gbg flex items-center justify-center text-gm flex-shrink-0">
                  <FileUp size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-ink">Anexos complementares</p>
                  <p className="text-[11px] text-muted leading-[1.5] mt-1">
                    Voce pode anexar mais de um arquivo, ou gerar sem anexar nada.
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
                + Anexar imagem ou documento
              </button>
            </div>

            <button
              onClick={generate}
              disabled={!canGenerate || generating}
              className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generating ? <><div className="spinner !w-5 !h-5" /> Gerando com IA...</> : <><Sparkles size={18} /> Gerar com IA</>}
            </button>
            {(usageError || usageMessage) && (
              <p className={`mt-3 rounded-app-sm border px-3 py-2 text-[12px] leading-[1.5] ${
                usageError ? 'border-red-200 bg-red-50 text-red-700' : 'border-gp bg-gbg text-gd'
              }`}>
                {usageError || usageMessage}
              </p>
            )}
          </div>
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
                    alt="Portfolio pedagogico gerado com IA"
                    className="w-full rounded-app-sm border border-border bg-cream"
                  />
                  <p className="text-[11px] text-muted leading-[1.5]">
                    A imagem foi gerada com base nas anotacoes e orientacoes selecionadas. O prompt usado foi salvo no documento.
                  </p>
                </div>
              ) : editingDocument ? (
                <textarea
                  className="w-full min-h-[320px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 text-[13px] text-ink outline-none leading-[1.65]"
                  value={editableContent}
                  onChange={(event) => setEditableContent(event.target.value)}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[12px] text-ink leading-[1.7]">{editableContent || savedContent || mockReport}</pre>
              )}
            </div>

            <button
              onClick={() => openSubscreen('generated-documents', { focusReportId: reportId })}
              className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold mb-2"
            >
              Historico de gerados
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

            <button onClick={archiveDocument} className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold mb-2">
              Arquivar
            </button>

            {reportKind === 'Relatorio de desenvolvimento' && selectedStudent?.id && (
              <button
                onClick={() => openSubscreen('generated-documents', { reportType: 'development_report', studentId: selectedStudent.id })}
                className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold mb-2"
              >
                Ver versoes desta crianca
              </button>
            )}

            <button onClick={() => {
              if (editingDocument && editableContent !== savedContent) {
                const discard = window.confirm('Voce tem alteracoes nao salvas. Deseja descartar?')
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

function matchesStudent(annotation: Annotation, studentId: string, studentName?: string) {
  if (annotation.studentId && annotation.studentId === studentId) return true
  if (studentName && annotation.studentName === studentName) return true
  return false
}

function getReportGenerationType(reportKind: string, portfolioOutput: PortfolioOutput): AiGenerationType {
  if (reportKind === 'Relatorio de desenvolvimento') return 'development_report'
  if (reportKind === 'Portfolio pedagogico') {
    return portfolioOutput === 'image' ? 'portfolio_image' : 'portfolio_text'
  }
  if (isSpecialistReport(reportKind) || reportKind === 'Rel. Atipico') return 'specialist_report'
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
  portfolioOutput: PortfolioOutput
}) {
  const annotationBlock = input.selectedAnnotations.length
    ? input.selectedAnnotations.map((annotation) => `- ${annotation.date} | ${annotation.label}: ${annotation.text}`).join('\n')
    : 'Nenhuma anotacao selecionada.'

  const sourceBlock = input.mode === 'blank'
    ? `RELATO INFORMADO PELA PROFESSORA\n\n${input.blankContext.trim() || '-'}`
    : `ANOTACOES SELECIONADAS\n\n${annotationBlock}\n\nDESCONSIDERAR\n\n${input.ignoredNotes.trim() || 'Nada informado para desconsiderar.'}`

  const header = `${input.reportKind.toUpperCase()}
Crianca: ${input.studentName}
Turma: ${input.className}
Periodo: 2026

BASE UTILIZADA

${sourceBlock}

ORIENTACAO ADICIONAL DA PROFESSORA

${input.extraContext.trim() || 'Nenhuma orientacao adicional foi incluida antes da geracao.'}`

  if (input.reportKind === 'Ficha de anamnese') {
    return `${header}

FICHA DE ANAMNESE

Identificacao e contexto familiar:
- dados da crianca, responsaveis e contatos;
- composicao familiar e rotina em casa;
- pessoas de referencia e vinculos importantes;
- entrada na escola e historico de adaptacao.

Historico de saude e desenvolvimento:
- gestacao, nascimento e marcos do desenvolvimento informados pela familia;
- acompanhamentos medicos ou terapeuticos, quando houver;
- alergias, medicacoes, restricoes e cuidados especificos;
- sono, alimentacao, higiene e autonomia.

Habitos e rotina:
- horarios, preferencias, medos, interesses e objetos de apego;
- formas de comunicacao usadas pela crianca;
- brincadeiras preferidas;
- situacoes que acalmam ou desorganizam.

Observacoes pedagogicas:
As informacoes devem apoiar o acolhimento, a seguranca e o planejamento de experiencias respeitosas para ${input.firstName}, sempre com acesso restrito e uso pedagogico autorizado.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
  }

  if (input.reportKind === 'Registro de reuniao de pais') {
    return `${header}

REGISTRO DE REUNIAO DE PAIS

Pauta:
- acolhimento da familia;
- apresentacao dos registros pedagogicos;
- rotina, desenvolvimento, autonomia e interacoes;
- combinados entre escola e familia.

Observacoes compartilhadas:
Registrar com linguagem objetiva o que foi apresentado, preservando a privacidade da crianca e mantendo foco em fatos observados na rotina escolar.

Combinados:
- estrategias que serao mantidas pela escola;
- possibilidades de continuidade em casa;
- comunicacoes futuras;
- responsabilidades e prazos, quando houver.

Encaminhamentos:
Formalizar proximos passos, necessidade de novo encontro ou acompanhamento da coordenacao. O registro nao deve expor outras criancas nem criar comparacoes.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
  }

  if (input.reportKind === 'Diario de bordo') {
    return `${header}

DIARIO DE BORDO PEDAGOGICO

Entrada do dia:
${input.firstName} participou da rotina com suas formas proprias de expressao, interacao e exploracao. Os registros selecionados ajudam a narrar o percurso vivido, valorizando pequenos gestos, falas, tentativas e descobertas.

Momentos observados:
- chegada, acolhimento e vinculo com a professora;
- participacao nas propostas coletivas;
- brincadeiras, interesses e escolhas espontaneas;
- interacoes com colegas;
- sinais de autonomia, linguagem, movimento e cuidado.

Reflexao da professora:
O registro deve apoiar a continuidade do olhar pedagogico, preservando a singularidade da crianca e ajudando a planejar novas experiencias para os proximos dias.

Proximos registros sugeridos:
- observar como a crianca se envolve em pequenos grupos;
- registrar falas espontaneas;
- acompanhar autonomia em momentos da rotina.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
  }

  if (input.reportKind === 'Portfolio pedagogico') {
    if (input.portfolioOutput === 'image') {
      return `${header}

PORTIFOLIO VISUAL COM CHATGPT

Objetivo da imagem:
Gerar uma capa ou painel visual para o portifolio pedagogico de ${input.firstName}, usando apenas informacoes e anexos autorizados pela professora.

Direcao visual:
- composicao clara, delicada e apropriada para educacao infantil;
- espacos para titulo, nome da crianca, turma e periodo;
- elementos de aprendizagem, brincadeira, natureza, artes e descobertas;
- nao expor outras criancas;
- usar fotos e documentos anexados apenas como referencia autorizada.

Prompt base para imagem:
"Criar uma capa de portifolio pedagogico infantil para ${input.firstName}, turma ${input.className}, com estetica acolhedora, organizada e profissional para educacao infantil. Usar tons suaves, elementos de aprendizagem, brincadeira, natureza, artes e descobertas. Evitar texto pequeno ilegivel e nao expor outras criancas."

Observacao:
Quando a API de imagem estiver ligada, esta opcao usara ChatGPT para gerar a imagem do portifolio. O texto pedagogico pode continuar sendo gerado separadamente.${formatAttachments(input.attachments)}

Imagem preparada com auxilio de IA a partir das informacoes autorizadas pela professora.`
    }

    return `${header}

PORTFOLIO PEDAGOGICO

Apresentacao:
Este portfolio organiza evidencias da jornada de ${input.firstName} na educacao infantil, reunindo registros de experiencias, producoes, falas, brincadeiras e momentos significativos.

Evidencias selecionadas:
- registros de atividades e exploracoes;
- observacoes da rotina;
- conquistas de autonomia;
- interacoes sociais;
- fotos ou documentos anexados pela professora, quando autorizados.

Leitura pedagogica:
As evidencias mostram como ${input.firstName} explora o ambiente, constroi vinculos, expressa ideias, participa das propostas e amplia suas possibilidades de comunicacao, movimento e convivencia.

Memoria afetiva:
Mais do que reunir atividades prontas, este portfolio guarda marcas do percurso vivido pela crianca, respeitando seu tempo, seus interesses e suas formas de aprender.

Continuidade:
Novas evidencias podem ser adicionadas ao longo do periodo para formar uma memoria pedagogica viva e segura.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
  }

  if (isSpecialistReport(input.reportKind) || input.reportKind === 'Rel. Atipico') {
    const specialistSections = getSpecialistSections(input.reportKind)
    return `${header}

RELATORIO PEDAGOGICO PARA ESPECIALISTA

Observacao de cuidado:
Este texto organiza observacoes pedagogicas e nao realiza diagnostico clinico. O foco e acolher ${input.firstName}, registrar fatos observados na escola e apoiar a continuidade do acompanhamento com a familia, equipe escolar e profissionais especializados.

Objetivo do documento:
${specialistSections.objective}

Eixos de observacao:
${specialistSections.axes.map((axis) => `- ${axis}`).join('\n')}

Potencialidades e respostas positivas:
- interesses, iniciativas e momentos de participacao;
- vinculos construidos com adultos e colegas;
- estrategias que favoreceram seguranca, comunicacao ou organizacao;
- situacoes em que a crianca demonstrou curiosidade, autonomia ou bem-estar.

Pontos de apoio observados:
- situacoes que exigem mediacao mais proxima;
- contextos de maior desafio na rotina;
- recursos, adaptacoes ou antecipacoes que podem ajudar;
- parceria necessaria entre escola, familia e especialista.

Encaminhamentos:
Manter registros frequentes, compartilhar apenas informacoes autorizadas e alinhar os proximos passos com coordenacao, familia e profissional responsavel.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
  }

  return `${header}

RELATORIO DE DESENVOLVIMENTO

Sintese do percurso:
${input.firstName} vem construindo sua jornada de desenvolvimento de forma unica, com registros que ajudam a compreender sua rotina, suas conquistas, seus interesses e os pontos que ainda precisam de acompanhamento.

Aspectos observados:
- linguagem oral, escuta e comunicacao;
- autonomia nos momentos da rotina;
- interacao com colegas e adultos;
- participacao em brincadeiras e propostas;
- expressao corporal, movimento e exploracao;
- emocao, seguranca e vinculos afetivos.

Avancos percebidos:
O texto final deve valorizar as evolucoes observadas sem transformar o desenvolvimento em comparacao ou medida rigida. Cada crianca tem seu tempo e sua forma de aprender.

Aspectos em acompanhamento:
Devem ser descritos com linguagem cuidadosa, indicando possibilidades de apoio, experiencias futuras e continuidade entre escola e familia.

Encaminhamentos:
Manter observacoes frequentes, registrar novas evolucoes e alinhar com a familia quando houver pontos que precisem de continuidade entre escola e casa.${formatAttachments(input.attachments)}

Documento gerado com auxilio de IA a partir das informacoes autorizadas pela professora.`
}

function formatAttachments(attachments: ReportAttachment[]) {
  if (!attachments.length) return ''
  return `\n\nANEXOS CONSIDERADOS\n\n${attachments.map((item) => `- ${item.name} (${formatFileSize(item.size)})`).join('\n')}`
}

function isSpecialistReport(reportKind: string) {
  return [
    'Relatorio para neuropediatra',
    'Relatorio para psiquiatra infantil',
    'Relatorio para fonoaudiologo',
    'Relatorio para terapeuta ocupacional',
    'Relatorio para psicologo',
    'Relatorio para psicopedagogo',
    'Encaminhamento para especialista',
  ].includes(reportKind)
}

function getSpecialistSections(reportKind: string) {
  if (reportKind === 'Relatorio para fonoaudiologo') {
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

  if (reportKind === 'Relatorio para terapeuta ocupacional') {
    return {
      objective: 'Descrever aspectos sensoriais, motores e de autonomia que interferem na participacao da crianca nas atividades diarias.',
      axes: [
        'processamento sensorial diante de ruidos, texturas, luz, cheiros e movimentos',
        'habilidades motoras finas, preensao, manipulacao e uso de materiais',
        'habilidades motoras grossas, equilibrio, coordenacao e brincadeiras corporais',
        'autonomia em alimentacao, higiene, vestuario e organizacao pessoal',
      ],
    }
  }

  if (reportKind === 'Relatorio para psicologo') {
    return {
      objective: 'Descrever aspectos emocionais, sociais e comportamentais observados na rotina escolar.',
      axes: [
        'regulacao emocional diante de alegria, tristeza, frustracao e espera',
        'interacao social com colegas e adultos',
        'participacao em atividades coletivas, cooperacao e combinados',
        'mudancas de humor, isolamento, medos ou preocupacoes observadas',
      ],
    }
  }

  if (reportKind === 'Relatorio para psicopedagogo') {
    return {
      objective: 'Descrever processos de aprendizagem, engajamento e estrategias que favorecem a participacao da crianca.',
      axes: [
        'formas de aprender: visual, auditiva, corporal, pratica ou por imitacao',
        'atencao, memoria, raciocinio logico e resolucao de problemas',
        'motivacao e engajamento nas propostas pedagogicas',
        'estrategias pedagogicas que funcionam melhor para a crianca',
      ],
    }
  }

  if (reportKind === 'Encaminhamento para especialista') {
    return {
      objective: 'Registrar de forma concisa as observacoes que justificam uma avaliacao externa, sem concluir diagnostico.',
      axes: [
        'motivo do encaminhamento e situacoes observadas',
        'frequencia, contexto e impacto na rotina escolar',
        'estrategias ja tentadas pela escola',
        'solicitacao de avaliacao e orientacoes para continuidade do acompanhamento',
      ],
    }
  }

  return {
    objective: 'Descrever observacoes pedagogicas sobre comunicacao, socializacao, comportamento, aspectos sensoriais, autonomia, psicomotricidade e aprendizagem.',
    axes: [
      'linguagem e comunicacao: gestos, contato visual, fala, vocabulario e compreensao',
      'habilidades sociais: interacao com pares e adultos, imitacao e brincadeiras coletivas',
      'comportamento: rotina, frustracoes, interesses, repeticoes, passividade ou agressividade',
      'aspectos sensoriais: sons, texturas, cheiros, luz e movimentos',
      'sono, alimentacao, higiene, vestuario e outras habilidades adaptativas',
      'aspectos psicomotores e cognitivos: coordenacao, atencao, memoria e resolucao de problemas',
    ],
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
