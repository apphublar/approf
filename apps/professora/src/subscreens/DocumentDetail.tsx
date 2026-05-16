import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getReportById, updateReport } from '@/services/reports'
import { generateAiPortfolioImage } from '@/services/ai-usage'
import type { GeneratedDocument, ReportStatus } from '@/types'

interface DocumentDetailSubscreenProps {
  data?: unknown
}

export default function DocumentDetailSubscreen({ data }: DocumentDetailSubscreenProps) {
  const { closeSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const reportId = typeof data === 'object' && data && 'reportId' in data
    ? String((data as { reportId?: string }).reportId ?? '')
    : ''

  const [document, setDocument] = useState<GeneratedDocument | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!reportId) {
      setError('Documento inv\u00e1lido.')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    getReportById(reportId)
      .then((item) => {
        if (!active) return
        setDocument(item)
        setDraft(item.body ?? '')
        setImagePrompt(getImagePrompt(item))
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'N\u00e3o foi poss\u00edvel carregar o documento.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reportId])

  const studentName = useMemo(() => {
    if (!document?.student_id) return null
    for (const classItem of classes) {
      const found = classItem.students.find((student) => student.id === document.student_id)
      if (found) return found.name
    }
    return null
  }, [document?.student_id, classes])

  const className = useMemo(() => {
    if (!document?.class_id) return null
    return classes.find((item) => item.id === document.class_id)?.name ?? null
  }, [document?.class_id, classes])

  const [imagePrompt, setImagePrompt] = useState('')
  const isImageDocument = document?.report_type === 'portfolio_image' || document?.ai_artifacts?.kind === 'portfolio_image'
  const hasChanges = document ? draft !== (document.body ?? '') : false

  function goBack() {
    if (hasChanges) {
      const discard = window.confirm('Voc\u00ea tem altera\u00e7\u00f5es n\u00e3o salvas. Deseja sair sem salvar?')
      if (!discard) return
    }
    closeSubscreen()
  }

  async function save(status?: ReportStatus) {
    if (!document) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateReport(document.id, {
        body: draft,
        status: status ?? document.status,
      })
      setDocument(updated)
      setDraft(updated.body ?? '')
      setMessage('Documento salvo com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'N\u00e3o foi poss\u00edvel salvar o documento.')
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    if (!document) return
    const confirmed = window.confirm('Deseja arquivar este documento?')
    if (!confirmed) return
    await save('archived')
  }

  async function restore() {
    if (!document) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateReport(document.id, {
        status: 'ready',
      })
      setDocument(updated)
      setDraft(updated.body ?? '')
      setImagePrompt(getImagePrompt(updated))
      setMessage('Item recuperado do arquivo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível recuperar o item.')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateImage() {
    if (!document || !isImageDocument) return
    const prompt = imagePrompt.trim()
    if (prompt.length < 20) {
      setError('Descreva a correção da imagem com pelo menos 20 caracteres.')
      return
    }

    setGeneratingImage(true)
    setError('')
    setMessage('')
    try {
      const result = await generateAiPortfolioImage({
        generationType: 'portfolio_image',
        classId: document.class_id,
        studentId: document.student_id,
        promptVersion: 'portfolio-image-correction-v1',
        requestSummary: {
          studentName,
          className,
          extraContext: prompt,
          blankContext: prompt,
        },
      })

      if (result.reportId) {
        const next = await getReportById(result.reportId)
        setDocument(next)
        setDraft(next.body ?? '')
        setImagePrompt(getImagePrompt(next))
      }
      setMessage('Nova imagem gerada e salva no histórico.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar uma nova imagem.')
    } finally {
      setGeneratingImage(false)
    }
  }

  async function toggleFinalVersion() {
    if (!document || document.report_type !== 'development_report') return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateReport(document.id, {
        isFinalVersion: !document.is_final_version,
      })
      setDocument(updated)
      setMessage(updated.is_final_version ? 'Vers\u00e3o final marcada.' : 'Vers\u00e3o final removida.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'N\u00e3o foi poss\u00edvel atualizar a vers\u00e3o final.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={goBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Documento</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="py-5">
          {loading ? (
            <div className="bg-white rounded-app p-4 border border-border shadow-card text-[12px] text-muted">
              Carregando documento...
            </div>
          ) : error ? (
            <div className="bg-white rounded-app p-4 border border-red-200 shadow-card text-[12px] text-red-700">
              {error}
            </div>
          ) : !document ? (
            <div className="bg-white rounded-app p-4 border border-border shadow-card text-[12px] text-muted">
              Documento n\u00e3o encontrado.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                <p className="text-[14px] font-bold text-ink">{formatReportType(document.report_type)}</p>
                <p className="text-[11px] text-muted mt-1">
                  {studentName ?? 'Sem crian\u00e7a'} {'\u2022'} {className ?? 'Sem turma'} {'\u2022'} {formatStatus(document.status)}
                  {document.is_final_version ? ' \u2022 Vers\u00e3o final' : ''}
                </p>
              </div>

              {isImageDocument && document.ai_artifacts?.imageDataUrl && (
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <img
                    src={document.ai_artifacts.imageDataUrl}
                    alt="Imagem de portfolio gerada com IA"
                    className="w-full rounded-app-sm border border-border bg-cream"
                  />
                </div>
              )}

              {isImageDocument ? (
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Ajustar prompt e gerar nova imagem
                  </label>
                  <p className="text-[12px] text-muted leading-[1.5] mt-2">
                    Edite a orientação abaixo para corrigir a próxima imagem. A imagem atual permanece salva no histórico.
                  </p>
                  <textarea
                    className="w-full min-h-[170px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-3 text-[13px] text-ink outline-none leading-[1.65]"
                    value={imagePrompt}
                    onChange={(event) => setImagePrompt(event.target.value)}
                  />
                  <button
                    onClick={regenerateImage}
                    disabled={generatingImage}
                    className="w-full mt-3 py-[13px] rounded-app-sm bg-gm text-white font-bold text-sm border-none disabled:opacity-50"
                  >
                    {generatingImage ? 'Gerando nova imagem...' : 'Gerar nova imagem corrigida'}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                    Conteúdo
                  </label>
                  <textarea
                    className="w-full min-h-[340px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[13px] text-ink outline-none leading-[1.65]"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </div>
              )}

              {message && (
                <p className="mb-3 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] text-gd">{message}</p>
              )}
              {error && (
                <p className="mb-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
              )}

              <div className="flex flex-col gap-2 pb-6">
                {!isImageDocument && (
                  <button
                    onClick={() => save('ready')}
                    disabled={saving || !hasChanges}
                    className="w-full py-[13px] rounded-app-sm bg-gd text-white font-bold text-sm border-none disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}

                {document.report_type === 'development_report' && (
                  <button
                    onClick={toggleFinalVersion}
                    disabled={saving}
                    className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
                  >
                    {document.is_final_version ? 'Remover vers\u00e3o final' : 'Marcar como vers\u00e3o final'}
                  </button>
                )}

                {document.status === 'archived' ? (
                  <button
                    onClick={restore}
                    disabled={saving}
                    className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
                  >
                    Recuperar do arquivo
                  </button>
                ) : (
                  <button
                    onClick={archive}
                    disabled={saving}
                    className="w-full py-[11px] rounded-app-sm border border-border bg-white text-muted text-sm font-bold"
                  >
                    Arquivar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatReportType(type: string) {
  switch (type) {
    case 'development_report': return 'Relat\u00f3rio de desenvolvimento'
    case 'planning': return 'Planejamento'
    case 'portfolio_text': return 'Portf\u00f3lio pedag\u00f3gico'
    case 'specialist_report': return 'Relat\u00f3rio para especialista'
    case 'general_report': return 'Relat\u00f3rio pedag\u00f3gico'
    default: return type
  }
}

function formatStatus(status: ReportStatus) {
  switch (status) {
    case 'draft': return 'Rascunho'
    case 'generating': return 'Gerando'
    case 'ready': return 'Pronto'
    case 'failed': return 'Falhou'
    case 'archived': return 'Arquivado'
    default: return status
  }
}

function getImagePrompt(document: GeneratedDocument) {
  if (typeof document.ai_artifacts?.prompt === 'string' && document.ai_artifacts.prompt.trim()) {
    return document.ai_artifacts.prompt.trim()
  }

  const body = document.body ?? ''
  const marker = 'Prompt usado:'
  const markerIndex = body.indexOf(marker)
  if (markerIndex >= 0) {
    return body.slice(markerIndex + marker.length).trim()
  }

  return body.trim()
}
