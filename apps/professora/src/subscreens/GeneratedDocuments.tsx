import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Download, Eye, FileText, Image as ImageIcon, Plus, Search, Share2 } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getReportById, listReports } from '@/services/reports'
import { generateImage } from '@/services/ai-usage'
import GenerationImageLoadingScreen from '@/components/ui/GenerationImageLoadingScreen'
import type { GeneratedDocument } from '@/types'

interface GeneratedDocumentsData {
  reportType?: string
  reportTypes?: string[]
  kind?: 'documents' | 'images' | 'all'
  studentId?: string
  classId?: string
  focusReportId?: string
}

type PeriodFilter = 'month' | 'all'
type ArchiveFilter = 'active' | 'archived'

export default function GeneratedDocumentsSubscreen({ data }: { data?: unknown }) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const filters = parseGeneratedDocumentsData(data)
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [imageDetailsById, setImageDetailsById] = useState<Record<string, { imageDataUrl?: string; prompt?: string; quality?: string }>>({})
  const isImagesMode = filters.kind === 'images'

  async function loadDocuments() {
    setLoading(true)
    try {
      const items = await listReports({
        limit: 80,
        studentId: filters.studentId,
        classId: filters.classId,
        compact: true,
      })
      setDocuments(sortFocusedFirst(items, filters.focusReportId))
      setImageDetailsById({})
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar documentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
      .catch(() => undefined)
  }, [filters.classId, filters.focusReportId, filters.studentId])

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    const selectedTypes = filters.reportTypes?.length
      ? filters.reportTypes
      : filters.reportType
        ? [filters.reportType]
        : []
    const scopedDocuments = documents
      .filter((doc) => selectedTypes.length === 0 || selectedTypes.includes(doc.report_type))
      .filter((doc) => filterByKind(doc, filters.kind ?? 'all'))
      .filter((doc) => archiveFilter === 'archived' ? doc.status === 'archived' : doc.status !== 'archived')
    const periodDocuments = period === 'month' ? scopedDocuments.filter(isFromCurrentMonth) : scopedDocuments
    if (!normalizedQuery) return periodDocuments
    return periodDocuments.filter((doc) =>
      normalizeText([
        formatReportType(doc.report_type),
        findStudentName(doc.student_id, classes),
        findClassName(doc.class_id, classes),
        doc.body ?? '',
      ].join(' ')).includes(normalizedQuery),
    )
  }, [documents, period, query, classes, filters.reportType, filters.reportTypes, filters.kind, archiveFilter])

  useEffect(() => {
    if (!isImagesMode) return
    const imageIds = visibleDocuments
      .filter((doc) => isImageReport(doc))
      .map((doc) => doc.id)
      .filter((id) => !imageDetailsById[id])
      .slice(0, 12)

    if (!imageIds.length) return
    let canceled = false

    Promise.all(
      imageIds.map(async (id) => {
        try {
          const report = await getReportById(id)
          return {
            id,
            imageDataUrl: report.ai_artifacts?.imageDataUrl,
            prompt: report.ai_artifacts?.prompt,
            quality: report.ai_artifacts?.quality,
          }
        } catch {
          return { id }
        }
      }),
    ).then((items) => {
      if (canceled) return
      setImageDetailsById((current) => {
        const next = { ...current }
        items.forEach((item) => { next[item.id] = item })
        return next
      })
    })

    return () => {
      canceled = true
    }
  }, [isImagesMode, visibleDocuments, imageDetailsById])

  const title = getTitle(filters)
  const subtitle = getSubtitle(filters, classes)

  async function createImage() {
    const normalized = description.trim()
    if (normalized.length < 12) {
      setError('Descreva melhor a imagem para continuar.')
      return
    }

    setCreating(true)
    setError('')
    setMessage('')
    try {
      const result = await generateImage({
        description: normalized,
        classId: filters.classId ?? null,
        studentId: filters.studentId ?? null,
      })

      if (!result.allowed) {
        setError('Você não possui GizTokens suficientes para criar esta imagem.')
        return
      }

      setMessage('Imagem criada com sucesso.')
      setIsCreateOpen(false)
      setDescription('')
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a imagem. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  function downloadImage(doc: GeneratedDocument) {
    const imageDataUrl = imageDetailsById[doc.id]?.imageDataUrl ?? doc.ai_artifacts?.imageDataUrl
    if (!imageDataUrl) return
    const anchor = window.document.createElement('a')
    anchor.href = imageDataUrl
    anchor.download = `imagem-${new Date(doc.created_at).getTime()}.png`
    window.document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  async function shareImage(doc: GeneratedDocument) {
    const imageDataUrl = imageDetailsById[doc.id]?.imageDataUrl ?? doc.ai_artifacts?.imageDataUrl
    if (!imageDataUrl || !navigator.share) return
    try {
      const file = dataUrlToFile(imageDataUrl, `imagem-${new Date(doc.created_at).getTime()}.png`)
      if ('canShare' in navigator && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Imagem',
          files: [file],
        })
        return
      }
      await navigator.share({
        title: 'Imagem',
        text: 'Confira esta imagem.',
      })
    } catch {
      // ignora cancelamento
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">{title}</span>
      </div>

      <div className="scroll-area px-[18px] py-5">
        <div className="bg-gbg border border-gp rounded-app p-4 mb-4">
          <p className="text-[13px] font-bold text-gd mb-2">{subtitle.heading}</p>
          <p className="text-[12px] text-muted leading-[1.6]">
            {subtitle.body}
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] text-gd">
            {message}
          </div>
        )}

        {isImagesMode && (
          <button
            onClick={() => {
              setError('')
              setMessage('')
              setIsCreateOpen(true)
            }}
            className="w-full mb-4 rounded-app-sm bg-gm text-white font-bold text-sm py-[13px] flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Nova imagem
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['month', 'all'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setPeriod(option)}
              className={`rounded-app-sm border px-3 py-2 text-[12px] font-bold transition-colors ${
                period === option
                  ? 'bg-gd text-white border-gd'
                  : 'bg-white text-muted border-border'
              }`}
            >
              {option === 'month' ? 'Este mês' : 'Todos'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['active', 'archived'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setArchiveFilter(option)}
              className={`rounded-app-sm border px-3 py-2 text-[12px] font-bold transition-colors ${
                archiveFilter === option
                  ? 'bg-gm text-white border-gm'
                  : 'bg-white text-muted border-border'
              }`}
            >
              {option === 'active' ? 'Ativos' : 'Arquivados'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
          <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
            <Search size={16} className="text-muted flex-shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isImagesMode ? 'Buscar imagem...' : 'Buscar documento...'}
              className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
            />
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-app p-4 border border-border shadow-card text-[12px] text-muted">
            Carregando documentos...
          </div>
        ) : error ? (
          <div className="bg-white rounded-app p-4 border border-red-200 shadow-card text-[12px] text-red-700">
            {error}
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
            <FileText size={24} className="text-gm mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">
              {archiveFilter === 'archived' ? 'Nenhum item arquivado' : getEmptyTitle(filters)}
            </p>
            <p className="text-[12px] text-muted mt-1 leading-[1.5]">
              {archiveFilter === 'archived'
                ? 'Quando você arquivar documentos ou imagens, eles aparecem aqui para consulta e recuperação.'
                : isImagesMode
                  ? 'Quando você criar uma imagem, ela aparece aqui automaticamente.'
                  : 'Quando você gerar um documento, o item salvo aparece aqui.'}
            </p>
          </div>
        ) : isImagesMode ? (
          <div className="flex flex-col gap-[10px] pb-8">
            {visibleDocuments.map((doc) => (
              <div key={doc.id} className="bg-white rounded-app p-4 border border-border shadow-card">
                {(imageDetailsById[doc.id]?.imageDataUrl || doc.ai_artifacts?.imageDataUrl) && (
                  <img
                    src={imageDetailsById[doc.id]?.imageDataUrl ?? doc.ai_artifacts?.imageDataUrl}
                    alt="Imagem gerada"
                    className="w-full h-[190px] object-cover rounded-app-sm border border-border"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <p className="text-[11px] text-muted mt-2">{formatDate(doc.created_at)}</p>
                <p className="text-[12px] text-ink mt-2 leading-[1.5] line-clamp-3">
                  {extractImageDescription(doc, imageDetailsById[doc.id])}
                </p>
                <p className="text-[11px] text-muted mt-2">
                  Qualidade: <span className="font-bold text-ink">{formatQuality(imageDetailsById[doc.id]?.quality ?? doc.ai_artifacts?.quality)}</span>
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    onClick={() => openSubscreen('document-detail', { reportId: doc.id })}
                    className="rounded-app-sm border border-gp bg-gbg py-2 text-[11px] font-bold text-gd flex items-center justify-center gap-1"
                  >
                    <Eye size={13} />
                    Visualizar
                  </button>
                  <button
                    onClick={() => downloadImage(doc)}
                    disabled={!(imageDetailsById[doc.id]?.imageDataUrl || doc.ai_artifacts?.imageDataUrl)}
                    className="rounded-app-sm border border-gp bg-gbg py-2 text-[11px] font-bold text-gd flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Download size={13} />
                    Salvar
                  </button>
                  <button
                    onClick={() => shareImage(doc)}
                    disabled={!navigator.share || !(imageDetailsById[doc.id]?.imageDataUrl || doc.ai_artifacts?.imageDataUrl)}
                    className="rounded-app-sm border border-gp bg-gbg py-2 text-[11px] font-bold text-gd flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Share2 size={13} />
                    Compartilhar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[9px] pb-8">
            {visibleDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => openSubscreen('document-detail', { reportId: doc.id })}
                className="w-full bg-white rounded-app p-4 border border-border shadow-card flex items-start gap-3 text-left active:scale-[.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-[12px] bg-gbg text-gm flex items-center justify-center flex-shrink-0">
                  {doc.report_type === 'portfolio_image' ? <ImageIcon size={18} /> : <FileText size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-ink leading-tight">{formatReportType(doc.report_type)}</p>
                    {doc.is_final_version && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-[#FFF3CD] text-[#856404] flex-shrink-0">
                        Final
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    {findStudentName(doc.student_id, classes) ?? 'Sem criança'} - {formatDate(doc.created_at)}
                  </p>
                  {isImageReport(doc) && doc.ai_artifacts?.imageDataUrl && (
                    <img
                      src={doc.ai_artifacts.imageDataUrl}
                      alt="Imagem de portfólio gerada"
                      className="w-full max-h-[120px] object-cover rounded-app-sm border border-border mt-3"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">
                    {isImageReport(doc)
                      ? 'Imagem gerada. Toque para visualizar.'
                      : (doc.body ?? '').slice(0, 150) || formatStatus(doc.status)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[22px] border-t border-border max-h-[85vh] overflow-auto stage-fade-in">
            {creating ? (
              <div className="p-5 bg-cream">
                <GenerationImageLoadingScreen />
              </div>
            ) : (
              <div className="p-5">
                <p className="text-[16px] font-serif text-gd">Nova imagem</p>
                <p className="text-[12px] text-muted mt-1 leading-[1.5]">
                  Descreva exatamente a imagem que deseja criar. Inclua estilo, cores, cenário e também o formato desejado.
                </p>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descreva exatamente a imagem que deseja criar. Inclua estilo, cores, cenário e também o formato desejado."
                  className="w-full mt-3 min-h-[180px] resize-none bg-cream border border-border rounded-app-sm px-3 py-3 text-[13px] text-ink outline-none leading-[1.6]"
                />

                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">Qualidade da imagem</p>
                <div className="mt-2 rounded-app-sm border border-gp bg-gbg px-3 py-3">
                  <p className="text-[13px] font-bold text-ink">Padrão otimizada</p>
                  <p className="text-[11px] text-muted mt-1">
                    Qualidade equilibrada para manter bom resultado com custo mais baixo.
                  </p>
                </div>

                {error && (
                  <p className="mt-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                    Não foi possível concluir a criação. Tente novamente.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-app-sm border border-border py-3 text-[13px] font-bold text-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createImage}
                    disabled={creating}
                    className="rounded-app-sm bg-gm text-white py-3 text-[13px] font-bold disabled:opacity-50"
                  >
                    Criar imagem
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function findStudentName(studentId: string | null, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (!studentId) return null
  for (const classItem of classes) {
    const student = classItem.students.find((item) => item.id === studentId)
    if (student) return student.name
  }
  return null
}

function findClassName(classId: string | null, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (!classId) return null
  return classes.find((item) => item.id === classId)?.name ?? null
}

function formatReportType(type: string) {
  const labels: Record<string, string> = {
    development_report: 'Relatório de desenvolvimento',
    class_diary: 'Diário de bordo',
    weekly_planning: 'Planejamento semanal',
    daily_lesson_plan: 'Plano de aula diário',
    pedagogical_project: 'Projeto pedagógico específico',
    portfolio_text: 'Portfólio pedagógico',
    portfolio_image: 'Imagem de portfólio',
    generated_image: 'Imagem',
    specialist_referral: 'Encaminhamento para especialista',
    specialist_report: 'Encaminhamento para especialista',
    parents_meeting_record: 'Registro de reunião de pais',
    manual_anamnesis: 'Ficha de anamnese',
    planning: 'Planejamento',
    general_report: 'Relatório pedagógico',
  }
  return labels[type] ?? 'Documento'
}

function parseGeneratedDocumentsData(data: unknown): GeneratedDocumentsData {
  if (!data || typeof data !== 'object') return {}
  const record = data as Record<string, unknown>
  return {
    reportType: typeof record.reportType === 'string' ? record.reportType : undefined,
    reportTypes: Array.isArray(record.reportTypes)
      ? record.reportTypes.filter((item): item is string => typeof item === 'string')
      : undefined,
    kind: record.kind === 'documents' || record.kind === 'images' || record.kind === 'all' ? record.kind : undefined,
    studentId: typeof record.studentId === 'string' ? record.studentId : undefined,
    classId: typeof record.classId === 'string' ? record.classId : undefined,
    focusReportId: typeof record.focusReportId === 'string' ? record.focusReportId : undefined,
  }
}

function sortFocusedFirst(items: GeneratedDocument[], focusReportId?: string) {
  if (!focusReportId) return items
  return [...items].sort((a, b) => {
    if (a.id === focusReportId) return -1
    if (b.id === focusReportId) return 1
    return 0
  })
}

function isFromCurrentMonth(doc: GeneratedDocument) {
  const date = new Date(doc.created_at)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function getTitle(filters: GeneratedDocumentsData) {
  if (filters.kind === 'images') return 'Imagens'
  if (filters.kind === 'documents') return 'Documentos'
  if (filters.reportType === 'portfolio_image' || filters.reportType === 'portfolio_text') return 'Portfólios'
  if (filters.reportType === 'development_report') return 'Relatórios'
  if (hasPlanningFilter(filters)) return 'Planejamentos'
  return 'Gerados'
}

function getSubtitle(filters: GeneratedDocumentsData, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (filters.kind === 'images') {
    return {
      heading: 'Imagens',
      body: 'Crie imagens e acesse seu histórico.',
    }
  }

  const studentName = filters.studentId ? findStudentName(filters.studentId, classes) : null
  if (studentName) {
    return {
      heading: `Histórico de ${studentName}`,
      body: 'Tudo que foi gerado para esta criança fica aqui, separado entre este mês e o histórico geral.',
    }
  }
  return {
    heading: filters.kind === 'documents' ? 'Histórico de documentos gerados' : 'Histórico de gerados',
    body: 'Documentos, planejamentos, relatórios e imagens salvos ficam aqui para visualizar, editar, arquivar, recuperar ou marcar versão final.',
  }
}

function hasPlanningFilter(filters: GeneratedDocumentsData) {
  const types = [
    ...(filters.reportType ? [filters.reportType] : []),
    ...(filters.reportTypes ?? []),
  ]
  return types.some((item) =>
    item === 'planning'
    || item === 'weekly_planning'
    || item === 'daily_lesson_plan'
    || item === 'pedagogical_project',
  )
}

function isImageReport(doc: GeneratedDocument) {
  return doc.report_type === 'portfolio_image'
    || doc.report_type === 'generated_image'
    || doc.ai_artifacts?.kind === 'portfolio_image'
    || doc.ai_artifacts?.kind === 'generated_image'
}

function filterByKind(doc: GeneratedDocument, kind: 'documents' | 'images' | 'all') {
  if (kind === 'all') return true
  if (kind === 'images') {
    return doc.report_type === 'generated_image' || doc.ai_artifacts?.kind === 'generated_image'
  }
  return !isImageReport(doc)
}

function getEmptyTitle(filters: GeneratedDocumentsData) {
  if (filters.kind === 'images') return 'Nenhuma imagem gerada'
  return 'Nenhum documento gerado'
}

function extractImageDescription(
  doc: GeneratedDocument,
  details?: { prompt?: string },
) {
  const prompt = details?.prompt?.trim() || doc.ai_artifacts?.prompt?.trim()
  if (prompt) return prompt
  return 'Abra a imagem para ver a descrição completa.'
}

function formatQuality(value?: string) {
  if (!value) return 'Padrão'
  if (value === 'standard' || value.toLowerCase() === 'padrão') return 'Padrão'
  if (value === 'high' || value.toLowerCase() === 'alta') return 'Alta'
  return 'Padrão'
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    generating: 'Gerando',
    ready: 'Pronto',
    failed: 'Falhou',
    archived: 'Arquivado',
  }
  return labels[status] ?? status
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, content] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const bytes = Uint8Array.from(atob(content ?? ''), (character) => character.charCodeAt(0))
  return new File([bytes], filename, { type: mime })
}


