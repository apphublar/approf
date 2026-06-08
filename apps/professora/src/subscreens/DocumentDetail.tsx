import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Download, FileText, Pencil, Printer, Share2 } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { createReportShareLink, getCachedReportById, getReportById, updateReport } from '@/services/reports'
import { generateAiPortfolioImage, generateImage } from '@/services/ai-usage'
import { previewGeneratedMaterialShare, publishGeneratedMaterialShare, type GeneratedMaterialPreview } from '@/services/materials'
import GenerationImageLoadingScreen from '@/components/ui/GenerationImageLoadingScreen'
import type { GeneratedDocument, ReportStatus } from '@/types'
import { getImageVariants, type ImageVariants } from '@/utils/image-performance'
import { fontFamilyCss, fontFamilyLabel, loadDocumentStyleSettings, textAlignLabel, type DocumentStyleSettings } from '@/utils/document-style'

interface DocumentDetailSubscreenProps {
  data?: unknown
}

export default function DocumentDetailSubscreen({ data }: DocumentDetailSubscreenProps) {
  const { closeSubscreen } = useNavStore()
  const { classes, userName, schoolName } = useAppStore()
  const reportId = typeof data === 'object' && data && 'reportId' in data
    ? String((data as { reportId?: string }).reportId ?? '')
    : ''
  const preloadedReport = typeof data === 'object' && data && 'preloadedReport' in data
    ? ((data as { preloadedReport?: GeneratedDocument | null }).preloadedReport ?? null)
    : null
  const initialReport = preloadedReport ?? (reportId ? getCachedReportById(reportId) : null)

  const [document, setDocument] = useState<GeneratedDocument | null>(initialReport)
  const [draft, setDraft] = useState(() => toEditorHtml(initialReport?.body ?? ''))
  const [loading, setLoading] = useState(!initialReport)
  const [saving, setSaving] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [editingImagePrompt, setEditingImagePrompt] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [imageVariants, setImageVariants] = useState<ImageVariants | null>(null)
  const [materialPreview, setMaterialPreview] = useState<GeneratedMaterialPreview | null>(null)
  const [sharingAsMaterial, setSharingAsMaterial] = useState(false)
  const [styleSettings] = useState<DocumentStyleSettings>(() => loadDocumentStyleSettings())
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!reportId) {
      setError('Documento inv\u00e1lido.')
      setLoading(false)
      return
    }

    let active = true
    if (!preloadedReport) setLoading(true)
    getReportById(reportId)
      .then((item) => {
        if (!active) return
        setDocument(item)
        setDraft(toEditorHtml(item.body ?? ''))
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
  }, [reportId, preloadedReport])

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

  const [imagePrompt, setImagePrompt] = useState(() => getImagePrompt(initialReport))
  const isImageDocument = document?.report_type === 'portfolio_image'
    || document?.report_type === 'generated_image'
    || document?.ai_artifacts?.kind === 'portfolio_image'
    || document?.ai_artifacts?.kind === 'generated_image'
  const hasChanges = document ? draft !== toEditorHtml(document.body ?? '') : false

  useEffect(() => {
    if (!document) return
    const sourceUrl = document.ai_artifacts?.mediumUrl
      ?? document.ai_artifacts?.imageDataUrl
      ?? document.ai_artifacts?.thumbnailUrl
    if (!sourceUrl) return
    let active = true
    getImageVariants(sourceUrl, document.id)
      .then((variants) => {
        if (!active) return
        setImageVariants(variants)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [document])

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
      setDraft(toEditorHtml(updated.body ?? ''))
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
      setDraft(toEditorHtml(updated.body ?? ''))
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
      const result = document.report_type === 'generated_image'
        ? await generateImage({
          description: prompt,
          classId: document.class_id,
          studentId: document.student_id,
        })
        : await generateAiPortfolioImage({
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
        setDraft(toEditorHtml(next.body ?? ''))
        setImagePrompt(getImagePrompt(next))
        setEditingImagePrompt(false)
      }
      setMessage('Imagem criada com sucesso e salva no histórico.')
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

  async function shareDocument() {
    if (!document) return
    const title = formatReportType(document.report_type)
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const shareUrl = await createReportShareLink(document.id)
      if (navigator.share) {
        await navigator.share({
          title,
          text: 'Vejá este documento gerado pelo Approf.',
          url: shareUrl,
        })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setMessage('Link publico copiado para compartilhar.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível compartilhar agora.')
    } finally {
      setSaving(false)
    }
  }

  async function prepareMaterialShare() {
    if (!document) return
    const confirmed = window.confirm('Para proteger a privacidade das crianças, este material sera anonimizado automaticamente antes de ser compartilhado com a comunidade.')
    if (!confirmed) return
    setSharingAsMaterial(true)
    setError('')
    setMessage('')
    try {
      if (!isImageDocument && hasChanges) {
        await save('ready')
      }
      const preview = await previewGeneratedMaterialShare({
        reportId: document.id,
        title: formatReportType(document.report_type),
        description: isImageDocument
          ? 'Referencia de exemplo criada a partir de imagem gerada e anonimizada.'
          : 'Documento pedagogico anonimizado para servir como referencia de exemplo.',
      })
      setMaterialPreview(preview)
      setMessage('Versao anonimizada pronta para sua revisão.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível preparar o material de apoio.')
    } finally {
      setSharingAsMaterial(false)
    }
  }

  async function publishMaterialShare() {
    if (!document || !materialPreview) return
    setSharingAsMaterial(true)
    setError('')
    setMessage('')
    try {
      const result = await publishGeneratedMaterialShare({
        reportId: document.id,
        title: materialPreview.title,
        description: materialPreview.description,
        shareableBody: materialPreview.shareableBody,
        review: materialPreview.review,
      })
      setMaterialPreview(null)
      setMessage(result.status === 'published'
        ? 'Material de apoio publicado com a versao anonimizada.'
        : 'Material enviado para revisão antes da publicação.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar o material de apoio.')
    } finally {
      setSharingAsMaterial(false)
    }
  }

  function downloadWord() {
    if (!document) return
    const title = formatReportType(document.report_type)
    const html = buildExportHtml(
      title,
      studentName,
      className,
      draft,
      styleSettings,
      imageVariants?.originalUrl ?? document.ai_artifacts?.imageDataUrl,
      userName,
      schoolName,
    )
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
    downloadBlob(blob, `${slugify(title)}.doc`)
  }

  function downloadPdf() {
    if (!document) return
    const title = formatReportType(document.report_type)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('Não foi possível abrir a janela de impressão.')
      return
    }
    printWindow.document.write(
      buildExportHtml(
        title,
        studentName,
        className,
        draft,
        styleSettings,
        imageVariants?.originalUrl ?? document.ai_artifacts?.imageDataUrl,
        userName,
        schoolName,
      ),
    )
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
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
                <p className="text-[10px] text-muted mt-2">
                  ABNT • Fonte {fontFamilyLabel(styleSettings.fontFamily)} {styleSettings.fontSizePt}pt • {textAlignLabel(styleSettings.textAlign)}
                </p>
              </div>

              {document.report_type === 'development_report' && document.coordinator_review_status && document.coordinator_review_status !== 'not_required' && (
                <div className={`rounded-app p-4 border shadow-card mb-4 ${getCoordinatorReviewBoxClass(document.coordinator_review_status)}`}>
                  <p className="text-[13px] font-bold">
                    Coordenadora: {formatCoordinatorReviewStatus(document.coordinator_review_status)}
                  </p>
                  {document.coordinator_review_notes && (
                    <p className="text-[12px] leading-[1.6] mt-2">
                      {document.coordinator_review_notes}
                    </p>
                  )}
                  {document.coordinator_review_status === 'changes_requested' && (
                    <p className="text-[11px] leading-[1.5] mt-2">
                      Edite o texto abaixo e salve. Depois, compartilhe novamente a turma com a coordenadora para uma nova revisão.
                    </p>
                  )}
                </div>
              )}

              {isImageDocument && document.ai_artifacts?.imageDataUrl && (
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <img
                    src={imageVariants?.mediumUrl ?? document.ai_artifacts.mediumUrl ?? document.ai_artifacts.imageDataUrl}
                    alt="Imagem gerada"
                    className="w-full max-h-[78vh] object-contain rounded-app-sm border border-border bg-cream"
                    loading="eager"
                    decoding="async"
                  />
                  {!imageVariants?.mediumUrl && (
                    <p className="text-[11px] text-muted mt-2">Carregando imagem otimizada...</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => downloadBlob(dataUrlToBlob(imageVariants?.originalUrl ?? document.ai_artifacts?.imageDataUrl ?? ''), 'portfolio.png')}
                      className="rounded-app-sm border border-gp bg-gbg py-3 text-[12px] font-bold text-gd flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      Baixar
                    </button>
                    <button
                      onClick={() => setEditingImagePrompt((current) => !current)}
                      className="rounded-app-sm border border-border bg-white py-3 text-[12px] font-bold text-muted flex items-center justify-center gap-2"
                    >
                      <Pencil size={14} />
                      {editingImagePrompt ? 'Fechar edição' : 'Editar prompt'}
                    </button>
                  </div>
                </div>
              )}

              {isImageDocument && !document.ai_artifacts?.imageDataUrl && (
                <div className="bg-white rounded-app p-4 border border-[#F1D58B] shadow-card mb-4">
                  <p className="text-[13px] font-bold text-[#856404]">Imagem não localizada neste registro</p>
                  <p className="text-[12px] text-muted leading-[1.5] mt-2">
                    Este item parece ter sido gerado antes do salvamento da imagem no histórico. Gere uma nova versão para manter a imagem salva.
                  </p>
                  <button
                    onClick={() => setEditingImagePrompt(true)}
                    className="w-full mt-3 py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
                  >
                    Editar prompt e gerar nova imagem
                  </button>
                </div>
              )}

              {isImageDocument ? (
                generatingImage ? (
                  <div className="bg-cream rounded-app p-4 border border-border shadow-card mb-4">
                    <GenerationImageLoadingScreen />
                  </div>
                ) : editingImagePrompt ? <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
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
                    Gerar nova imagem corrigida
                  </button>
                </div> : null
              ) : (
                <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                      Editor do documento
                    </label>
                    <span className="text-[10px] text-muted">BNCC EI + padrão formal ABNT</span>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[420px] bg-white rounded-app-sm border border-border px-4 py-4 text-ink outline-none document-editor"
                    style={{
                      fontFamily: fontFamilyCss(styleSettings.fontFamily),
                      fontSize: `${styleSettings.fontSizePt}pt`,
                      lineHeight: String(styleSettings.lineSpacing),
                      textAlign: styleSettings.textAlign,
                    }}
                    dangerouslySetInnerHTML={{ __html: draft }}
                    onInput={(event) => setDraft((event.currentTarget as HTMLDivElement).innerHTML)}
                  />
                </div>
              )}

              {message && (
                <p className="mb-3 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] text-gd">{message}</p>
              )}
              {error && (
                <p className="mb-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
              )}

              {materialPreview && (
                <div className="bg-white rounded-app p-4 border border-gp shadow-card mb-4">
                  <p className="text-[13px] font-bold text-ink">Revisar material de apoio anonimizado</p>
                  <p className="text-[11px] text-muted leading-[1.5] mt-1">
                    Esta e a versao compartilhavel. A imagem ou documento original nao sera publicado.
                  </p>
                  <input
                    className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-3 text-[13px] outline-none"
                    value={materialPreview.title}
                    onChange={(event) => setMaterialPreview((current) => current ? { ...current, title: event.target.value } : current)}
                  />
                  <textarea
                    className="w-full min-h-[72px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[13px] outline-none leading-[1.5]"
                    value={materialPreview.description}
                    onChange={(event) => setMaterialPreview((current) => current ? { ...current, description: event.target.value } : current)}
                  />
                  <textarea
                    className="w-full min-h-[220px] resize-y bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[12px] outline-none leading-[1.6]"
                    value={materialPreview.shareableBody}
                    onChange={(event) => setMaterialPreview((current) => current ? { ...current, shareableBody: event.target.value } : current)}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => setMaterialPreview(null)}
                      disabled={sharingAsMaterial}
                      className="py-[11px] rounded-app-sm border border-border bg-white text-muted text-xs font-bold disabled:opacity-50"
                    >
                      Fechar
                    </button>
                    <button
                      onClick={publishMaterialShare}
                      disabled={sharingAsMaterial}
                      className="py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-xs font-bold disabled:opacity-50"
                    >
                      {sharingAsMaterial ? 'Publicando...' : 'Publicar'}
                    </button>
                  </div>
                </div>
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
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={downloadPdf} className="py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-xs font-bold flex items-center justify-center gap-1">
                    <Printer size={13} />
                    PDF
                  </button>
                  <button onClick={downloadWord} className="py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-xs font-bold flex items-center justify-center gap-1">
                    <FileText size={13} />
                    Word
                  </button>
                  <button onClick={shareDocument} disabled={saving} className="py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                    <Share2 size={13} />
                    Link
                  </button>
                </div>

                <button
                  onClick={prepareMaterialShare}
                  disabled={sharingAsMaterial || saving}
                  className="w-full py-[11px] rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold disabled:opacity-50"
                >
                  {sharingAsMaterial ? 'Anonimizando...' : 'Compartilhar como material de apoio'}
                </button>

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
    case 'development_report': return 'Relatório de desenvolvimento'
    case 'class_diary': return 'Diário de bordo'
    case 'weekly_planning': return 'Planejamento semanal'
    case 'daily_lesson_plan': return 'Plano de aula diário'
    case 'pedagogical_project': return 'Projeto pedagógico específico'
    case 'planning': return 'Planejamento'
    case 'portfolio_text': return 'Portfólio pedagógico'
    case 'portfolio_image': return 'Portfólio pedagógico'
    case 'generated_image': return 'Imagem'
    case 'specialist_referral': return 'Relatório para especialista'
    case 'specialist_report': return 'Relatório para especialista'
    case 'parents_meeting_record': return 'Planejamento de reunião de pais'
    case 'general_report': return 'Relatório pedagógico'
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

function formatCoordinatorReviewStatus(status: string) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Correção solicitada'
  return 'Aguardando revisão'
}

function getCoordinatorReviewBoxClass(status: string) {
  if (status === 'approved') return 'bg-gbg border-gp text-gd'
  if (status === 'changes_requested') return 'bg-[#FFF1F1] border-[#F3C0B1] text-[#8A2F16]'
  return 'bg-[#FFF8E8] border-[#EAD58A] text-[#856404]'
}

function getImagePrompt(document: GeneratedDocument | null) {
  if (!document) return ''
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

function toEditorHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function buildExportHtml(
  title: string,
  studentName: string | null,
  className: string | null,
  bodyHtml: string,
  settings: DocumentStyleSettings,
  imageDataUrl?: string,
  teacherName?: string,
  schoolName?: string,
) {
  const bodyContent = imageDataUrl
    ? `<div class="image-wrap"><img src="${imageDataUrl}" alt="Imagem do documento" /></div>`
    : bodyHtml
  const logoDataUrl = settings.schoolLogoDataUrl
  const letterheadClass = `letterhead-${settings.letterheadStyle}`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 2.5cm 2cm 2cm 3cm; }
    body { font-family: ${fontFamilyCss(settings.fontFamily)}; color: #111; line-height: ${settings.lineSpacing}; font-size: ${settings.fontSizePt}pt; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; margin: 0 0 24pt; font-weight: ${settings.boldTitles ? 700 : 500}; }
    h2 { font-size: 12pt; text-transform: uppercase; margin: 18pt 0 8pt; font-weight: ${settings.boldTitles ? 700 : 500}; }
    p { margin: 0 0 12pt; text-align: ${settings.textAlign}; text-indent: ${settings.paragraphIndentCm}cm; }
    .meta { margin-bottom: 18pt; font-size: 11pt; color: #333; }
    .letterhead { margin-bottom: 16pt; ${settings.letterheadStyle === 'centered' ? 'text-align:center;' : 'display:flex;justify-content:flex-start;'} }
    .letterhead img { max-height: 72px; object-fit: contain; }
    .letterhead-watermark { position: fixed; top: 35%; left: 10%; width: 80%; opacity: .08; z-index: -1; }
    .image-wrap img { width: 100%; max-height: 900px; object-fit: contain; border: 1px solid #ddd; }
    .sheet-footer { position: fixed; left: 0; right: 0; bottom: .7cm; font-size: 10pt; color: #555; display: flex; justify-content: space-between; padding: 0 2cm 0 3cm; }
  </style>
</head>
<body>
  ${logoDataUrl && settings.letterheadStyle !== 'watermark' ? `<div class="letterhead ${letterheadClass}"><img src="${logoDataUrl}" alt="Logo da escola" /></div>` : ''}
  ${logoDataUrl && settings.letterheadStyle === 'watermark' ? `<img class="letterhead-watermark" src="${logoDataUrl}" alt="" />` : ''}
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <p><strong>Criança:</strong> ${escapeHtml(studentName ?? 'Sem criança')}</p>
    <p><strong>Turma:</strong> ${escapeHtml(className ?? 'Sem turma')}</p>
  </div>
  ${bodyContent}
  <div class="sheet-footer">
    <span>${escapeHtml(teacherName ?? 'Professora')}</span>
    <span>${escapeHtml(schoolName ?? 'Escola')}</span>
  </div>
</body>
</html>`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = atob(data ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'documento'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
