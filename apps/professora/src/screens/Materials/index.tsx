import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from 'react'
import {
  ExternalLink,
  FileText,
  Flag,
  Heart,
  ImageIcon,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  analyzeAndUploadMaterial,
  deleteMaterial,
  listSupportMaterials,
  rateMaterial,
  registerMaterialDownload,
  registerMaterialView,
  reportMaterial,
  setMaterialFavorite,
  type MaterialAnalysisResult,
  type MaterialUploadStatus,
  type SupportMaterial,
} from '@/services/materials'
import { getSupabaseClient } from '@/services/supabase/client'

type TabId = 'all' | 'mine' | 'favorites' | 'blocked'
type SortBy = 'newest' | 'downloads' | 'rating' | 'oldest' | 'name'
type KindFilter = 'all' | 'documents' | 'images'
type MaterialKind = 'document' | 'image'

const ACCEPTED_MATERIALS = ['.pdf', '.docx', '.xlsx', '.pptx', '.jpg', '.jpeg', '.png', '.webp', 'image/jpeg', 'image/png', 'image/webp'].join(',')
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'mine', label: 'Meus enviados' },
  { id: 'favorites', label: 'Meus favoritos' },
  { id: 'blocked', label: 'Bloqueados' },
]

export default function MaterialsScreen() {
  const [materials, setMaterials] = useState<SupportMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortBy>('newest')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState<SupportMaterial | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'analyzing'>('idle')
  const [uploadMsg, setUploadMsg] = useState('')
  const [analysis, setAnalysis] = useState<MaterialAnalysisResult | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [mobileUploadBlocked] = useState(() => isMobileUploadContext())

  const canSubmit = Boolean(title.trim() && desc.trim() && file && !submitting)

  const filtered = useMemo(() => {
    let list = [...materials]
    if (tab === 'all') list = list.filter((m) => m.status === 'published')
    else if (tab === 'mine') list = list.filter((m) => m.author_id === userId)
    else if (tab === 'favorites') list = list.filter((m) => m.is_favorite)
    else if (tab === 'blocked') list = list.filter((m) => m.status === 'blocked' && m.author_id === userId)
    if (kindFilter === 'documents') list = list.filter((m) => getKindFromMaterial(m) === 'document')
    else if (kindFilter === 'images') list = list.filter((m) => getKindFromMaterial(m) === 'image')
    if (query.trim()) {
      const q = normalizeText(query)
      list = list.filter(
        (m) => normalizeText(m.title).includes(q) || normalizeText(m.description ?? '').includes(q),
      )
    }
    if (sort === 'newest') list.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    else if (sort === 'downloads') list.sort((a, b) => Number(b.downloads_count ?? 0) - Number(a.downloads_count ?? 0))
    else if (sort === 'rating') list.sort((a, b) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0))
    else if (sort === 'oldest') list.sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''))
    else list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return list
  }, [materials, tab, query, sort, kindFilter, userId])

  const counts = useMemo(
    () => ({
      all: materials.filter((m) => m.status === 'published').length,
      mine: materials.filter((m) => m.author_id === userId).length,
      favorites: materials.filter((m) => m.is_favorite).length,
      blocked: materials.filter((m) => m.status === 'blocked' && m.author_id === userId).length,
    }),
    [materials, userId],
  )

  useEffect(() => {
    void init()
  }, [])

  useEffect(() => {
    if (!file || getKindFromFile(file) !== 'image') {
      setFilePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function init() {
    const supabase = getSupabaseClient()
    if (supabase) {
      const { data } = await supabase.auth.getSession()
      setUserId(data.session?.user.id ?? null)
    }
    await refresh()
  }

  async function refresh() {
    setLoading(true)
    try {
      setMaterials(await listSupportMaterials())
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  function openUpload() {
    setTitle('')
    setDesc('')
    setFile(null)
    setUploadMsg('')
    setAnalysis(null)
    setShowUpload(true)
  }

  function pickFile(f?: File | null) {
    if (f && !isAllowedMaterialFile(f)) {
      setFile(null)
      setUploadMsg('Arquivo não permitido. Envie PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
      return
    }
    if (f && f.size > MAX_BYTES) {
      setFile(null)
      setUploadMsg(`O arquivo precisa ter até ${MAX_MB} MB.`)
      return
    }
    setFile(f ?? null)
    setUploadMsg('')
  }

  function onNativeMaterialChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const selectedFile = input.files?.[0] ?? null
    if (selectedFile) pickFile(selectedFile)
    window.setTimeout(() => {
      input.value = ''
    }, 0)
  }

  async function submitMaterial() {
    if (!file || !canSubmit) return
    setSubmitting(true)
    setUploadPhase('uploading')
    setUploadMsg('')
    setAnalysis(null)
    try {
      window.setTimeout(() => setUploadPhase((p) => (p === 'uploading' ? 'analyzing' : p)), 800)
      const result = await analyzeAndUploadMaterial({
        title: title.trim(),
        description: desc.trim(),
        file,
      })
      setAnalysis(result)
      setUploadMsg(getStatusMessage(result.status))
      setTitle('')
      setDesc('')
      setFile(null)
      await refresh()
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Não foi possível enviar o material.')
    } finally {
      setSubmitting(false)
      setUploadPhase('idle')
    }
  }

  async function handleDelete(id: string) {
    await deleteMaterial(id)
    if (preview?.id === id) setPreview(null)
    await refresh()
  }

  function openPreview(material: SupportMaterial) {
    setPreview(material)
    void registerMaterialView(material.id).then(() => {
      setMaterials((current) => current.map((item) => (
        item.id === material.id ? { ...item, views_count: Number(item.views_count ?? 0) + 1 } : item
      )))
      setPreview((current) => current?.id === material.id
        ? { ...current, views_count: Number(current.views_count ?? 0) + 1 }
        : current)
    }).catch(() => undefined)
  }

  async function toggleFavorite(material: SupportMaterial, favorite: boolean) {
    setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, is_favorite: favorite } : item))
    setPreview((current) => current?.id === material.id ? { ...current, is_favorite: favorite } : current)
    try {
      await setMaterialFavorite(material.id, favorite)
    } catch (error) {
      setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, is_favorite: !favorite } : item))
      setPreview((current) => current?.id === material.id ? { ...current, is_favorite: !favorite } : current)
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel atualizar o favorito.')
    }
  }

  async function handleDownload(material: SupportMaterial) {
    try {
      await registerMaterialDownload(material.id)
      setMaterials((current) => current.map((item) => (
        item.id === material.id ? { ...item, downloads_count: Number(item.downloads_count ?? 0) + 1 } : item
      )))
      setPreview((current) => current?.id === material.id
        ? { ...current, downloads_count: Number(current.downloads_count ?? 0) + 1 }
        : current)
    } catch {
      // Keep the file opening even if the counter cannot be updated.
    }
  }

  async function handleRating(material: SupportMaterial, rating: number, comment: string) {
    await rateMaterial(material.id, rating, comment)
    const updated = await listSupportMaterials()
    setMaterials(updated)
    setPreview(updated.find((item) => item.id === material.id) ?? { ...material, my_rating: rating, my_rating_comment: comment })
  }

  async function handleReport(material: SupportMaterial, reason: string, details: string) {
    await reportMaterial(material.id, reason, details)
    await refresh()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      {/* ── Header ── */}
      <div className="bg-white px-[18px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[22px] text-gd leading-[1.2]">Material de Apoio</h1>
            <p className="text-[11px] text-muted mt-0.5">Recursos pedagógicos para sua sala de aula</p>
          </div>
          <button
            type="button"
            onClick={openUpload}
            className="flex items-center gap-1.5 bg-gd text-white rounded-app-sm px-3 py-2 text-[12px] font-bold flex-shrink-0 mt-1"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>

        <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2 mt-3">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar materiais..."
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-muted"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-muted">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-border flex-shrink-0">
        <div className="flex overflow-x-auto scrollbar-none px-[14px] gap-1.5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-gd text-white' : 'bg-cream border border-border text-muted'
              }`}
            >
              {t.label}
              {counts[t.id] > 0 && (
                <span className={`ml-1 ${tab === t.id ? 'opacity-75' : 'text-gm'}`}>{counts[t.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sort bar ── */}
      <div className="flex items-center justify-between px-[18px] py-2 flex-shrink-0">
        <p className="text-[11px] text-muted">
          {filtered.length} {filtered.length === 1 ? 'material' : 'materiais'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-border bg-white text-muted"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortBy)}
            className="text-[11px] border border-border rounded-app-sm px-2 py-1 bg-white text-muted outline-none"
          >
            <option value="newest">Mais recentes</option>
            <option value="downloads">Mais baixados</option>
            <option value="rating">Melhor avaliados</option>
            <option value="oldest">Mais antigos</option>
            <option value="name">A–Z</option>
          </select>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className="text-[11px] border border-border rounded-app-sm px-2 py-1 bg-white text-muted outline-none"
          >
            <option value="all">Arquivos</option>
            <option value="documents">Documentos</option>
            <option value="images">Imagens</option>
          </select>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-[14px] pb-28 pt-1 overscroll-contain">
        {filtered.length === 0 ? (
          <EmptyState tab={tab} hasSearch={Boolean(query.trim())} onAdd={openUpload} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                userId={userId}
                onDelete={() => handleDelete(m.id)}
                onPreview={() => openPreview(m)}
                onFavorite={(favorite) => toggleFavorite(m, favorite)}
                onDownload={() => handleDownload(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Upload Sheet ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-white">
          <div className="flex items-center gap-3 px-[18px] pt-12 pb-3 border-b border-border flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted"
            >
              <X size={18} />
            </button>
            <span className="font-serif text-[18px] text-gd flex-1">Adicionar Material</span>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[18px] pb-8"
            style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="py-4 flex flex-col gap-4">
              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Tema ou nome do arquivo</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-3 text-[13px] outline-none focus:border-gp"
                  placeholder="Ex: Sequencia didatica sobre cores e formas"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Descricao</span>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full min-h-[96px] resize-none rounded-app-sm border border-border px-3 py-3 text-[13px] leading-[1.5] outline-none focus:border-gp"
                  placeholder="Descreva como esse material ajuda na pratica pedagogica."
                />
              </label>

              {mobileUploadBlocked ? (
                <UploadDesktopOnlyNotice />
              ) : (
                <div className={`rounded-app border border-dashed border-gp bg-gbg px-4 py-5 text-center ${submitting ? 'opacity-50' : ''}`}>
                  <UploadCloud size={26} className="mx-auto text-gm" />
                  <p className="mt-2 text-[13px] font-bold text-gd">
                    {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
                  </p>
                  <p className="mb-3 mt-1 text-[11px] leading-[1.5] text-muted">
                    PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP ate {MAX_MB} MB
                  </p>
                  <label className="flex w-full items-center justify-center gap-2 rounded-app-sm bg-gd px-3 py-3 text-[13px] font-bold text-white">
                    <UploadCloud size={15} />
                    Escolher arquivo
                    <input
                      type="file"
                      accept={ACCEPTED_MATERIALS}
                      disabled={submitting}
                      onChange={onNativeMaterialChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              {file && (
                <div className="rounded-app-sm border border-border bg-cream p-3 flex items-center gap-3">
                  <MaterialIcon kind={getKindFromFile(file)} />
                  {filePreviewUrl && (
                    <img
                      src={filePreviewUrl}
                      alt=""
                      className="h-14 w-14 flex-shrink-0 rounded-app-sm border border-border object-cover bg-white"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-ink truncate">{file.name}</p>
                    <p className="text-[11px] text-muted">{formatFileSize(file.size)}</p>
                    <p className="text-[10px] text-muted truncate">{file.type || 'MIME vazio'}</p>
                  </div>
                  <button type="button" onClick={() => pickFile(null)} className="text-[11px] font-bold text-[#C1440E]">
                    remover
                  </button>
                </div>
              )}

              {uploadMsg && (
                <div
                  className={`rounded-app-sm border px-3 py-3 text-[12px] leading-[1.5] ${
                    analysis?.status === 'blocked'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gp bg-gbg text-gd'
                  }`}
                >
                  {uploadMsg}
                </div>
              )}

              {analysis && (
                <div className="rounded-app-sm border border-border p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[12px] font-bold text-ink">Resultado da análise</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getStatusClass(analysis.status)}`}>
                      {formatStatus(analysis.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">Confiança: {Math.round(analysis.review.confianca * 100)}%</p>
                  <p className="mt-1 text-[11px] text-muted">Categoria: {analysis.review.categoria_detectada}</p>
                  {analysis.review.motivo && (
                    <p className="mt-2 text-[12px] leading-[1.5] text-soft">{analysis.review.motivo}</p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void submitMaterial()}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-app bg-gd py-4 text-[15px] font-bold text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                {submitting
                  ? uploadPhase === 'uploading'
                    ? 'Enviando arquivo...'
                    : 'Analisando arquivo...'
                  : 'Enviar material'}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-white">
          <div className="flex items-center gap-3 px-[18px] pt-12 pb-3 border-b border-border flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted flex-shrink-0"
            >
              <X size={18} />
            </button>
            <span className="font-serif text-[17px] text-gd flex-1 line-clamp-1">{preview.title}</span>
            <span className={`rounded-full px-2 py-1 text-[9px] font-bold flex-shrink-0 ${getStatusClass(preview.status ?? 'published')}`}>
              {formatStatus(preview.status ?? 'published')}
            </span>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[18px] pb-8"
            style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="py-4 flex flex-col gap-4">
              {getKindFromMaterial(preview) === 'image' && preview.downloadUrl && (
                <img
                  src={preview.downloadUrl}
                  alt=""
                  className="w-full rounded-app border border-border object-contain max-h-64 bg-cream"
                />
              )}

              {preview.description && (
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-[0.07em] mb-1">Descrição</p>
                  <p className="text-[13px] text-soft leading-[1.6]">{preview.description}</p>
                </div>
              )}

              {preview.content_preview && (
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-[0.07em] mb-1">Pré-visualização</p>
                  <div className="rounded-app-sm border border-border bg-cream px-3 py-3 text-[11px] leading-[1.6] text-muted">
                    {preview.content_preview}
                  </div>
                </div>
              )}

              <div className="rounded-app border border-border divide-y divide-border overflow-hidden">
                {preview.file_name && <InfoRow label="Arquivo" value={preview.file_name} />}
                {!!preview.file_size_bytes && <InfoRow label="Tamanho" value={formatFileSize(preview.file_size_bytes)} />}
                {preview.detected_category && <InfoRow label="Categoria" value={preview.detected_category} />}
                {preview.author_name && <InfoRow label="Autor" value={preview.author_name} />}
                {preview.author_id && <InfoRow label="Reputacao" value={getTeacherReputation(materials, preview.author_id)} />}
                <InfoRow label="Downloads" value={String(preview.downloads_count ?? 0)} />
                <InfoRow label="Visualizacoes" value={String(preview.views_count ?? 0)} />
                <InfoRow label="Avaliacoes" value={formatRatingSummary(preview)} />
                {preview.published_at && (
                  <InfoRow
                    label="Data"
                    value={new Date(preview.published_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => void toggleFavorite(preview, !preview.is_favorite)}
                className={`flex items-center justify-center gap-2 rounded-app-sm border py-3 text-[13px] font-bold ${
                  preview.is_favorite ? 'border-red-200 bg-red-50 text-red-700' : 'border-border bg-white text-muted'
                }`}
              >
                <Heart size={15} fill={preview.is_favorite ? 'currentColor' : 'none'} />
                {preview.is_favorite ? 'Favorito' : 'Favoritar'}
              </button>

              <RatingBox material={preview} onRate={handleRating} />
              <ReportBox material={preview} onReport={handleReport} />

              <div className="flex gap-2">
                {preview.downloadUrl && (
                  <>
                    <a
                      href={preview.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void handleDownload(preview)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-app-sm border border-gp bg-gbg py-3 text-[13px] font-bold text-gd"
                    >
                      <ExternalLink size={15} />
                      Visualizar
                    </a>
                    <a
                      href={preview.downloadUrl}
                      download={preview.file_name ?? preview.title}
                      onClick={() => void handleDownload(preview)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-app-sm bg-gd py-3 text-[13px] font-bold text-white"
                    >
                      <Download size={15} />
                      Baixar
                    </a>
                  </>
                )}
                {(preview.status === 'blocked' || preview.status === 'em_analise') &&
                  preview.author_id === userId && (
                    <DeleteButton onDelete={() => handleDelete(preview.id)} />
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialCard({
  material,
  userId,
  onDelete,
  onPreview,
  onFavorite,
  onDownload,
}: {
  material: SupportMaterial
  userId: string | null
  onDelete: () => Promise<void>
  onPreview: () => void
  onFavorite: (favorite: boolean) => Promise<void>
  onDownload: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const kind = getKindFromMaterial(material)
  const isDeletable =
    (material.status === 'blocked' || material.status === 'em_analise') && material.author_id === userId

  async function doDelete(e: MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Excluir este material permanentemente?')) return
    setDeleting(true)
    try {
      await onDelete()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel excluir este material.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="bg-white rounded-app border border-border shadow-card flex flex-col overflow-hidden cursor-pointer active:opacity-80"
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPreview()}
    >
      {kind === 'image' && material.downloadUrl ? (
        <img src={material.downloadUrl} alt="" className="h-28 w-full object-cover bg-cream" />
      ) : (
        <div className="h-28 flex items-center justify-center bg-gbg border-b border-border">
          <FileText size={30} className="text-gm opacity-40" />
        </div>
      )}

      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <div className="flex items-start gap-1">
          <p className="text-[12px] font-bold text-ink line-clamp-2 leading-[1.3] flex-1">{material.title}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void onFavorite(!material.is_favorite)
            }}
            className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center ${
              material.is_favorite ? 'bg-red-50 text-red-600' : 'bg-cream text-muted'
            }`}
            aria-label={material.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart size={13} fill={material.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <span className={`self-start rounded-full px-2 py-0.5 text-[9px] font-bold ${getStatusClass(material.status ?? 'published')}`}>
          {formatStatus(material.status ?? 'published')}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="inline-flex items-center gap-0.5">
            <Star size={10} className="text-[#B7791F]" fill={Number(material.average_rating ?? 0) > 0 ? 'currentColor' : 'none'} />
            {Number(material.average_rating ?? 0).toFixed(1)}
          </span>
          <span>{Number(material.downloads_count ?? 0)} downloads</span>
        </div>
        {material.description && (
          <p className="text-[10px] text-muted line-clamp-2 leading-[1.4]">{material.description}</p>
        )}
        {!!material.file_size_bytes && (
          <p className="text-[10px] text-muted mt-auto">{formatFileSize(material.file_size_bytes)}</p>
        )}
      </div>

      {(material.downloadUrl || isDeletable) && (
        <div className="flex border-t border-border" onClick={(e) => e.stopPropagation()}>
          {material.downloadUrl && (
            <a
              href={material.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center py-2 text-[11px] font-bold text-gm gap-1"
              onClick={(e) => {
                e.stopPropagation()
                void onDownload()
              }}
            >
              <ExternalLink size={11} />
              Abrir
            </a>
          )}
          {isDeletable && (
            <button
              type="button"
              onClick={doDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center py-2 text-[11px] font-bold text-red-600 gap-1 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  tab,
  hasSearch,
  onAdd,
}: {
  tab: TabId
  hasSearch: boolean
  onAdd: () => void
}) {
  if (hasSearch) {
    return (
      <div className="text-center py-16 flex flex-col items-center">
        <Search size={32} className="text-muted mb-3 opacity-40" />
        <p className="text-[14px] font-bold text-ink">Nenhum resultado encontrado</p>
        <p className="text-[12px] text-muted mt-1">Tente outra busca</p>
      </div>
    )
  }

  const messages: Partial<Record<TabId, { title: string; subtitle: string; showAdd: boolean }>> = {
    all: { title: 'Nenhum material ainda', subtitle: 'Adicione seu primeiro material de apoio!', showAdd: true },
    mine: { title: 'Você não enviou materiais', subtitle: 'Toque em "Adicionar" para enviar seu primeiro material.', showAdd: true },
    blocked: { title: 'Nenhum material bloqueado', subtitle: 'Ótimo! Nenhum material foi bloqueado pela análise.', showAdd: false },
  }

  const { title, subtitle, showAdd } = messages[tab] ?? {
    title: 'Nenhum favorito ainda',
    subtitle: 'Favorite materiais para encontrar rapidamente depois.',
    showAdd: false,
  }

  return (
    <div className="text-center py-16 flex flex-col items-center">
      <div className="w-20 h-20 rounded-[24px] bg-gbg flex items-center justify-center text-gm mb-4">
        <FileText size={36} />
      </div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      <p className="text-[12px] text-muted mt-1 max-w-[260px] leading-[1.5]">{subtitle}</p>
      {showAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 flex items-center gap-2 bg-gd text-white rounded-app-sm px-4 py-2.5 text-[13px] font-bold"
        >
          <Plus size={15} />
          Adicionar material
        </button>
      )}
    </div>
  )
}

function MaterialIcon({ kind }: { kind: MaterialKind }) {
  const Icon = kind === 'image' ? ImageIcon : FileText
  return (
    <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-[13px] border border-gp bg-gbg text-gm">
      <Icon size={20} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <span className="text-[11px] text-muted w-20 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-ink flex-1 break-all">{value}</span>
    </div>
  )
}

function RatingBox({
  material,
  onRate,
}: {
  material: SupportMaterial
  onRate: (material: SupportMaterial, rating: number, comment: string) => Promise<void>
}) {
  const [rating, setRating] = useState(material.my_rating ?? 0)
  const [comment, setComment] = useState(material.my_rating_comment ?? '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!rating) return
    setSaving(true)
    try {
      await onRate(material, rating, comment)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel salvar a avaliacao.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-app-sm border border-border bg-white p-3">
      <p className="text-[12px] font-bold text-ink">Avaliar material</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#B7791F]"
            aria-label={`${value} estrelas`}
          >
            <Star size={20} fill={value <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={800}
        className="mt-2 w-full min-h-[72px] resize-none rounded-app-sm border border-border px-3 py-2 text-[12px] leading-[1.5] outline-none focus:border-gp"
        placeholder="Comentario opcional sobre o material"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!rating || saving}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-app-sm bg-gd py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        Salvar avaliacao
      </button>
    </div>
  )
}

function ReportBox({
  material,
  onReport,
}: {
  material: SupportMaterial
  onReport: (material: SupportMaterial, reason: string, details: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('dados_pessoais')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    setSending(true)
    try {
      await onReport(material, reason, details)
      setOpen(false)
      setDetails('')
      window.alert('Denuncia registrada para moderacao.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel registrar a denuncia.')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-app-sm border border-border bg-white py-3 text-[13px] font-bold text-muted"
      >
        <Flag size={15} />
        Denunciar material
      </button>
    )
  }

  return (
    <div className="rounded-app-sm border border-red-100 bg-red-50 p-3">
      <p className="text-[12px] font-bold text-red-800">Denunciar material</p>
      <select
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-2 w-full rounded-app-sm border border-red-100 bg-white px-3 py-2 text-[12px] outline-none"
      >
        <option value="dados_pessoais">Dados pessoais</option>
        <option value="imagem_crianca">Imagem de crianca</option>
        <option value="conteudo_inadequado">Conteudo inadequado</option>
        <option value="spam">Propaganda ou spam</option>
        <option value="outro">Outro motivo</option>
      </select>
      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={800}
        className="mt-2 w-full min-h-[72px] resize-none rounded-app-sm border border-red-100 bg-white px-3 py-2 text-[12px] leading-[1.5] outline-none"
        placeholder="Detalhes opcionais"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-app-sm border border-red-100 bg-white py-2.5 text-[12px] font-bold text-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="flex-1 rounded-app-sm bg-red-700 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)

  async function doDelete() {
    if (!window.confirm('Excluir este material permanentemente?')) return
    setDeleting(true)
    try {
      await onDelete()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel excluir este material.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void doDelete()}
      disabled={deleting}
      className="flex items-center justify-center gap-2 rounded-app-sm border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 disabled:opacity-50"
    >
      {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      Excluir
    </button>
  )
}

function getKindFromFile(file: File): MaterialKind {
  if (file.type.startsWith('image/')) return 'image'
  if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => file.name.toLowerCase().endsWith(ext))) return 'image'
  return 'document'
}

function getKindFromMaterial(material: SupportMaterial): MaterialKind {
  if (material.file_type?.startsWith('image/') || material.mime_type?.startsWith('image/')) return 'image'
  const name = (material.file_name ?? '').toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext))) return 'image'
  return 'document'
}

function isAllowedMaterialFile(file: File) {
  const name = file.name.toLowerCase()
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return true
  if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext))) return true
  return ['.pdf', '.docx', '.xlsx', '.pptx'].some((ext) => name.endsWith(ext))
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function formatStatus(status: MaterialUploadStatus) {
  if (status === 'published') return 'Aprovado'
  if (status === 'blocked') return 'Bloqueado'
  if (status === 'em_analise') return 'Em análise'
  return 'Revisão'
}

function formatRatingSummary(material: SupportMaterial) {
  const count = Number(material.ratings_count ?? 0)
  const average = Number(material.average_rating ?? 0)
  if (!count) return 'Sem avaliacoes'
  return `${average.toFixed(1)} estrelas (${count})`
}

function getTeacherReputation(materials: SupportMaterial[], authorId: string) {
  const published = materials.filter((item) => item.author_id === authorId && item.status === 'published')
  const count = published.length
  const average = published.reduce((sum, item) => sum + Number(item.average_rating ?? 0), 0) / Math.max(1, count)
  if (count >= 15 && average >= 4.6) return 'Referencia Pedagogica'
  if (count >= 8 && average >= 4.3) return 'Colaboradora Destaque'
  if (count >= 3) return 'Colaboradora'
  return 'Colaboradora iniciante'
}

function getStatusMessage(status: MaterialUploadStatus) {
  if (status === 'published') return 'Material aprovado e publicado com sucesso!'
  if (status === 'blocked') return 'Material bloqueado pela análise de segurança. Não foi publicado.'
  if (status === 'em_analise') return 'Material salvo. A análise de IA ficará pendente para revisão manual.'
  return 'Material enviado para revisão antes de ficar disponível.'
}

function getStatusClass(status: MaterialUploadStatus) {
  if (status === 'published') return 'bg-gbg text-gd border border-gp'
  if (status === 'blocked') return 'bg-red-50 text-red-700 border border-red-200'
  if (status === 'em_analise') return 'bg-orange-50 text-orange-700 border border-orange-200'
  return 'bg-[#FFF3CD] text-[#856404] border border-[#EAD58A]'
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function UploadDesktopOnlyNotice() {
  return (
    <div className="rounded-app-sm border border-gp bg-gbg px-4 py-4">
      <p className="text-[13px] font-bold text-gd">Envio disponível pelo computador</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-muted">
        Para proteger os materiais compartilhados e garantir uma análise mais completa antes da publicação, o envio deve ser feito pelo computador. Pelo celular, você pode consultar, baixar e editar os materiais normalmente.
      </p>
    </div>
  )
}

function isMobileUploadContext() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  const mobileUa = /android|iphone|ipad|ipod|mobile/.test(ua)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return mobileUa || standalone
}
