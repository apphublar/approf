import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react'
import {
  analyzeAndUploadMaterial,
  deleteMaterial,
  listSupportMaterials,
  type MaterialAnalysisResult,
  type MaterialUploadStatus,
  type SupportMaterial,
  type UploadDebugStep,
} from '@/services/materials'
import { getSupabaseClient } from '@/services/supabase/client'
import { pickFileFromDevice } from '@/services/file-picker'

type TabId = 'all' | 'mine' | 'blocked'
type SortBy = 'newest' | 'oldest' | 'name'
type KindFilter = 'all' | 'documents' | 'images'
type MaterialKind = 'document' | 'image'

const ACCEPTED_MATERIALS = ['.pdf', '.docx', '.xlsx', '.pptx', 'image/jpeg', 'image/png', 'image/webp'].join(',')
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'mine', label: 'Meus enviados' },
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
  const [debugSteps, setDebugSteps] = useState<UploadDebugStep[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [adminUrl, setAdminUrl] = useState<string | null>(null)

  const canSubmit = Boolean(title.trim() && desc.trim() && file && !submitting)

  const filtered = useMemo(() => {
    let list = [...materials]
    if (tab === 'all') list = list.filter((m) => m.status === 'published')
    else if (tab === 'mine') list = list.filter((m) => m.author_id === userId)
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
    else if (sort === 'oldest') list.sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''))
    else list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return list
  }, [materials, tab, query, sort, kindFilter, userId])

  const counts = useMemo(
    () => ({
      all: materials.filter((m) => m.status === 'published').length,
      mine: materials.filter((m) => m.author_id === userId).length,
      blocked: materials.filter((m) => m.status === 'blocked' && m.author_id === userId).length,
    }),
    [materials, userId],
  )

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    setAdminUrl(import.meta.env.VITE_APPROF_ADMIN_API_URL ?? '(não configurado)')
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
    setDebugSteps([])
    setShowDebug(false)
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
    setDebugSteps([])
  }

  async function openMaterialPicker() {
    if (submitting) return
    try {
      const selectedFile = await pickFileFromDevice({ accept: ACCEPTED_MATERIALS, debugKey: 'material-apoio' })
      pickFile(selectedFile)
    } catch (error) {
      setUploadMsg(error instanceof Error ? error.message : 'Nao foi possivel abrir o seletor de arquivos.')
      setShowDebug(true)
    }
  }

  async function submitMaterial() {
    if (!file || !canSubmit) return
    setSubmitting(true)
    setUploadPhase('uploading')
    setUploadMsg('')
    setAnalysis(null)
    setDebugSteps([])
    try {
      window.setTimeout(() => setUploadPhase((p) => (p === 'uploading' ? 'analyzing' : p)), 800)
      const result = await analyzeAndUploadMaterial({
        title: title.trim(),
        description: desc.trim(),
        file,
        onDebugStep: setDebugSteps,
      })
      setAnalysis(result)
      setUploadMsg(getStatusMessage(result.status))
      setTitle('')
      setDesc('')
      setFile(null)
      await refresh()
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Não foi possível enviar o material.')
      setShowDebug(true)
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
                onPreview={() => setPreview(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Upload Sheet ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
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

          <div className="flex-1 overflow-y-auto px-[18px] pb-8">
            <div className="py-4 flex flex-col gap-4">
              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Tema ou nome do arquivo</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-3 text-[13px] outline-none focus:border-gp"
                  placeholder="Ex: Sequência didática sobre cores e formas"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Descrição</span>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full min-h-[96px] resize-none rounded-app-sm border border-border px-3 py-3 text-[13px] leading-[1.5] outline-none focus:border-gp"
                  placeholder="Descreva como esse material ajuda na prática pedagógica."
                />
              </label>

              <button
                type="button"
                onClick={() => void openMaterialPicker()}
                disabled={submitting}
                className="flex min-h-[120px] w-full flex-col items-center justify-center rounded-app border border-dashed border-gp bg-gbg px-4 py-5 text-center disabled:opacity-50"
              >
                <UploadCloud size={26} className="text-gm" />
                <span className="mt-2 text-[13px] font-bold text-gd">
                  {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
                </span>
                <span className="mt-1 text-[11px] leading-[1.5] text-muted">
                  PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP até {MAX_MB} MB
                </span>
              </button>

              {file && (
                <div className="rounded-app-sm border border-border bg-cream p-3 flex items-center gap-3">
                  <MaterialIcon kind={getKindFromFile(file)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-ink truncate">{file.name}</p>
                    <p className="text-[11px] text-muted">{formatFileSize(file.size)}</p>
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
                    : 'Analisando com IA...'
                  : 'Enviar material'}
              </button>

              {/* Debug panel */}
              <div className="rounded-app border border-amber-200 bg-amber-50 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setShowDebug((v) => !v)}
                >
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Diagnóstico de upload</span>
                  <span className="text-[10px] text-amber-600">{showDebug ? 'ocultar' : 'mostrar'}</span>
                </button>
                {showDebug && (
                  <div className="mt-3 space-y-1.5">
                    <DebugRow label="Admin URL" value={adminUrl ?? '...'} />
                    <DebugRow label="Usuário ID" value={userId ?? '(sem sessão)'} />
                    {file && (
                      <>
                        <DebugRow label="Arquivo" value={file.name} />
                        <DebugRow label="MIME" value={file.type || '(vazio)'} warn={!file.type} />
                        <DebugRow label="Tamanho" value={formatFileSize(file.size)} />
                      </>
                    )}
                    {debugSteps.length > 0 && (
                      <div className="mt-2 space-y-1 pt-1 border-t border-amber-200">
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Etapas</p>
                        {debugSteps.map((step) => (
                          <div key={step.id} className="flex items-start gap-2">
                            {step.status === 'ok' && <CheckCircle2 size={13} className="mt-[2px] shrink-0 text-green-600" />}
                            {step.status === 'error' && <XCircle size={13} className="mt-[2px] shrink-0 text-red-600" />}
                            {step.status === 'running' && <Loader2 size={13} className="mt-[2px] shrink-0 animate-spin text-amber-600" />}
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-ink">{step.label}</p>
                              {step.detail && (
                                <p className={`mt-0.5 break-all text-[10px] leading-[1.4] ${step.status === 'error' ? 'text-red-700' : 'text-muted'}`}>
                                  {step.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
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

          <div className="flex-1 overflow-y-auto px-[18px] pb-8">
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

              <div className="flex gap-2">
                {preview.downloadUrl && (
                  <a
                    href={preview.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-app-sm border border-gp bg-gbg py-3 text-[13px] font-bold text-gd"
                  >
                    <ExternalLink size={15} />
                    Visualizar arquivo
                  </a>
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
}: {
  material: SupportMaterial
  userId: string | null
  onDelete: () => Promise<void>
  onPreview: () => void
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
        <p className="text-[12px] font-bold text-ink line-clamp-2 leading-[1.3]">{material.title}</p>
        <span className={`self-start rounded-full px-2 py-0.5 text-[9px] font-bold ${getStatusClass(material.status ?? 'published')}`}>
          {formatStatus(material.status ?? 'published')}
        </span>
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
              onClick={(e) => e.stopPropagation()}
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

  const messages: Record<TabId, { title: string; subtitle: string; showAdd: boolean }> = {
    all: { title: 'Nenhum material ainda', subtitle: 'Adicione seu primeiro material de apoio!', showAdd: true },
    mine: { title: 'Você não enviou materiais', subtitle: 'Toque em "Adicionar" para enviar seu primeiro material.', showAdd: true },
    blocked: { title: 'Nenhum material bloqueado', subtitle: 'Ótimo! Nenhum material foi bloqueado pela análise.', showAdd: false },
  }

  const { title, subtitle, showAdd } = messages[tab]

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

function DebugRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-amber-700">{label}: </span>
      <span className={`break-all text-[10px] ${warn ? 'text-red-700 font-bold' : 'text-ink'}`}>{value}</span>
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
