import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
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
  type MaterialUploadStatus,
  type SupportMaterial,
} from '@/services/materials'
import { getSupabaseClient } from '@/services/supabase/client'
import { clearDraft, loadDraft, saveDraft } from '@/utils/draft'
import AgeRangeSelector from '@/components/ui/AgeRangeSelector'

type QueuedFile = {
  file: File
  previewUrl: string | null
  status: 'pending' | 'sending' | 'done' | 'error'
  statusMsg: string
}

type TabId = 'all' | 'mine' | 'favorites' | 'blocked'
type SortBy = 'newest' | 'downloads' | 'rating' | 'oldest' | 'name'
type KindFilter = 'all' | 'documents' | 'images'
type StatusFilter = 'all' | MaterialUploadStatus
type MaterialKind = 'document' | 'image'

const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024
const DEFAULT_AGE_RANGE = '0 a 5 anos'
const UPLOAD_DRAFT_KEY = 'approf:draft:material-upload'
const DOC_ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf', '.docx', '.xlsx', '.pptx',
].join(',')

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
  const [ageFilter, setAgeFilter] = useState('all')
  const [objectiveFilter, setObjectiveFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState<SupportMaterial | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [ageRange, setAgeRange] = useState(DEFAULT_AGE_RANGE)
  const [pedagogicalObjective, setPedagogicalObjective] = useState('')
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const draftRestoredRef = useRef(false)

  const canSubmit = Boolean(title.trim() && desc.trim() && queue.length > 0 && !submitting)

  useEffect(() => {
    if (draftRestoredRef.current) return
    draftRestoredRef.current = true
    const draft = loadDraft<{ title: string; desc: string; ageRange: string; pedagogicalObjective: string; showUpload: boolean }>(UPLOAD_DRAFT_KEY)
    if (draft?.showUpload) {
      setTitle(draft.title || '')
      setDesc(draft.desc || '')
      setAgeRange(draft.ageRange || DEFAULT_AGE_RANGE)
      setPedagogicalObjective(draft.pedagogicalObjective || '')
      setShowUpload(true)
    }
  }, [])

  useEffect(() => {
    if (!showUpload || submitting) return
    const timeout = window.setTimeout(() => {
      saveDraft(UPLOAD_DRAFT_KEY, { title, desc, ageRange, pedagogicalObjective, showUpload: true })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [showUpload, submitting, title, desc, ageRange, pedagogicalObjective])

  const filtered = useMemo(() => {
    let list = [...materials]
    if (tab === 'all') list = list.filter((m) => m.status === 'published')
    else if (tab === 'mine') list = list.filter((m) => m.author_id === userId)
    else if (tab === 'favorites') list = list.filter((m) => m.is_favorite)
    else if (tab === 'blocked') list = list.filter((m) => m.status === 'blocked' && m.author_id === userId)
    if (kindFilter === 'documents') list = list.filter((m) => getKindFromMaterial(m) === 'document')
    else if (kindFilter === 'images') list = list.filter((m) => getKindFromMaterial(m) === 'image')
    if (ageFilter !== 'all') list = list.filter((m) => (m.age_range ?? '') === ageFilter)
    if (objectiveFilter !== 'all') list = list.filter((m) => (m.pedagogical_objective ?? m.detected_category ?? '') === objectiveFilter)
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter)
    if (query.trim()) {
      const q = normalizeText(query)
      list = list.filter(
        (m) => normalizeText(m.title).includes(q)
          || normalizeText(m.description ?? '').includes(q)
          || normalizeText(m.age_range ?? '').includes(q)
          || normalizeText(m.pedagogical_objective ?? '').includes(q)
          || normalizeText(m.detected_category ?? '').includes(q),
      )
    }
    if (sort === 'newest') list.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    else if (sort === 'downloads') list.sort((a, b) => Number(b.downloads_count ?? 0) - Number(a.downloads_count ?? 0))
    else if (sort === 'rating') list.sort((a, b) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0))
    else if (sort === 'oldest') list.sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''))
    else list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return list
  }, [materials, tab, query, sort, kindFilter, ageFilter, objectiveFilter, statusFilter, userId])

  const objectiveOptions = useMemo(() => {
    const values = new Set<string>()
    for (const material of materials) {
      const value = (material.pedagogical_objective ?? material.detected_category ?? '').trim()
      if (value) values.add(value)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [materials])

  const ageOptions = useMemo(() => {
    const values = new Set<string>()
    for (const material of materials) {
      const value = (material.age_range ?? '').trim()
      if (value) values.add(value)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  }, [materials])

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
    setAgeRange(DEFAULT_AGE_RANGE)
    setPedagogicalObjective('')
    setQueue((current) => {
      current.forEach((entry) => { if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl) })
      return []
    })
    setUploadMsg('')
    setShowUpload(true)
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const newEntries: QueuedFile[] = []
    for (const f of Array.from(fileList)) {
      if (!isAllowedMaterialFile(f)) {
        setUploadMsg('Arquivo não permitido. Envie PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
        continue
      }
      if (f.size > MAX_BYTES) {
        setUploadMsg(`"${f.name}" excede ${MAX_MB} MB e não pode ser adicionado.`)
        continue
      }
      newEntries.push({
        file: f,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        status: 'pending',
        statusMsg: '',
      })
    }
    if (newEntries.length > 0) {
      setQueue((current) => [...current, ...newEntries])
      setUploadMsg('')
    }
  }

  function removeFromQueue(index: number) {
    setQueue((current) => {
      const entry = current[index]
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      return current.filter((_, i) => i !== index)
    })
  }

  async function submitMaterial() {
    if (!canSubmit) return
    setSubmitting(true)
    setUploadMsg('')
    const snapshot = queue.slice()
    let anyError = false

    for (let i = 0; i < snapshot.length; i++) {
      if (snapshot[i].status !== 'pending') continue
      setQueue((current) => current.map((entry, idx) =>
        idx === i ? { ...entry, status: 'sending', statusMsg: 'Enviando...' } : entry,
      ))
      try {
        const result = await analyzeAndUploadMaterial({
          title: title.trim(),
          description: desc.trim(),
          ageRange,
          pedagogicalObjective: pedagogicalObjective.trim() || desc.trim(),
          file: snapshot[i].file,
        })
        setQueue((current) => current.map((entry, idx) =>
          idx === i ? { ...entry, status: 'done', statusMsg: getStatusMessage(result.status) } : entry,
        ))
      } catch (e) {
        anyError = true
        setQueue((current) => current.map((entry, idx) =>
          idx === i ? { ...entry, status: 'error', statusMsg: e instanceof Error ? e.message : 'Não foi possível enviar.' } : entry,
        ))
      }
    }

    setSubmitting(false)
    if (!anyError) {
      clearDraft(UPLOAD_DRAFT_KEY)
      setTitle('')
      setDesc('')
      setAgeRange(DEFAULT_AGE_RANGE)
      setPedagogicalObjective('')
    }
    await refresh()
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
      window.alert(error instanceof Error ? error.message : 'Não foi possível atualizar o favorito.')
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
        <div className="mt-3 rounded-app-sm border border-[#EAD58A] bg-[#FFF8D8] px-3 py-2 text-[11px] leading-[1.5] text-[#856404]">
          Não serão aceitos documentos ou imagens com dados pessoais, nomes de crianças, telefones, e-mails, endereços ou imagens de crianças.
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
      <div className="px-[18px] py-2 flex-shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
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
            <option value="rating">Melhores avaliados</option>
            <option value="oldest">Mais antigos</option>
            <option value="name">A-Z</option>
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
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
            className="text-[11px] border border-border rounded-app-sm px-2 py-1 bg-white text-muted outline-none"
          >
            <option value="all">Faixa etaria</option>
            {ageOptions.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
          <select
            value={objectiveFilter}
            onChange={(e) => setObjectiveFilter(e.target.value)}
            className="text-[11px] border border-border rounded-app-sm px-2 py-1 bg-white text-muted outline-none"
          >
            <option value="all">Objetivo</option>
            {objectiveOptions.map((objective) => (
              <option key={objective} value={objective}>{objective}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-[11px] border border-border rounded-app-sm px-2 py-1 bg-white text-muted outline-none"
          >
            <option value="all">Status</option>
            <option value="published">Aprovado</option>
            <option value="em_analise">Em analise</option>
            <option value="review_required">Revisao</option>
            <option value="blocked">Bloqueado</option>
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
              onClick={() => { clearDraft(UPLOAD_DRAFT_KEY); setShowUpload(false) }}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted"
            >
              <X size={18} />
            </button>
            <span className="font-serif text-[18px] text-gd flex-1">Adicionar material</span>
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

              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Faixa etária</span>
                <AgeRangeSelector value={ageRange} onChange={setAgeRange} />
              </label>

              <label className="block">
                <span className="block text-[11px] font-bold text-muted mb-1">Objetivo pedagógico</span>
                <input
                  value={pedagogicalObjective}
                  onChange={(e) => setPedagogicalObjective(e.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-3 text-[13px] outline-none focus:border-gp"
                  placeholder="Ex: ampliar repertório oral, coordenação motora, rotina..."
                />
              </label>

              <div className={`rounded-app border border-dashed border-gp bg-gbg px-4 py-4 ${submitting ? 'opacity-50 pointer-events-none' : ''}`}>
                <p className="text-[13px] font-bold text-gd text-center mb-1">Adicionar arquivos</p>
                <p className="text-[11px] leading-[1.5] text-muted text-center mb-3">
                  Imagens (JPG, PNG, WEBP) — múltiplas de uma vez. Documentos (PDF, DOCX, XLSX, PPTX) — um por vez. Até {MAX_MB} MB cada.
                </p>
                <div className="flex gap-2">
                  <label className="relative flex-1 flex items-center justify-center gap-1.5 rounded-app-sm border border-gp bg-white px-3 py-2.5 text-[12px] font-bold text-gm overflow-hidden cursor-pointer">
                    <ImageIcon size={14} />
                    <span aria-hidden="true">Imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={submitting}
                      onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <label className="relative flex-1 flex items-center justify-center gap-1.5 rounded-app-sm bg-gd px-3 py-2.5 text-[12px] font-bold text-white overflow-hidden cursor-pointer">
                    <FileText size={14} />
                    <span aria-hidden="true">Documento</span>
                    <input
                      type="file"
                      accept={DOC_ACCEPT}
                      disabled={submitting}
                      onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              {queue.length > 0 && (
                <div className="flex flex-col gap-2">
                  {queue.map((entry, index) => (
                    <div key={index} className="rounded-app-sm border border-border bg-cream p-3 flex items-center gap-3">
                      {entry.previewUrl ? (
                        <img src={entry.previewUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-app-sm border border-border object-cover bg-white" />
                      ) : (
                        <MaterialIcon kind="document" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-ink truncate">{entry.file.name}</p>
                        <p className="text-[10px] text-muted">{formatFileSize(entry.file.size)}</p>
                        {entry.statusMsg && (
                          <p className={`text-[10px] mt-0.5 leading-[1.4] ${entry.status === 'error' ? 'text-[#C1440E]' : entry.status === 'done' ? 'text-gm' : 'text-muted'}`}>
                            {entry.statusMsg}
                          </p>
                        )}
                      </div>
                      {entry.status === 'sending' ? (
                        <Loader2 size={15} className="animate-spin text-gm flex-shrink-0" />
                      ) : entry.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => removeFromQueue(index)}
                          className="text-[11px] font-bold text-[#C1440E] flex-shrink-0"
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {uploadMsg && (
                <p className="text-[12px] text-[#C1440E] leading-[1.5]">{uploadMsg}</p>
              )}

              <button
                type="button"
                onClick={() => void submitMaterial()}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-app bg-gd py-4 text-[15px] font-bold text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                {submitting
                  ? 'Enviando...'
                  : queue.length > 1
                  ? `Enviar ${queue.length} materiais`
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
                {preview.age_range && <InfoRow label="Faixa" value={preview.age_range} />}
                {preview.pedagogical_objective && <InfoRow label="Objetivo" value={preview.pedagogical_objective} />}
                {preview.author_name && <InfoRow label="Autora" value={preview.author_name} />}
                {preview.author_id && <InfoRow label="Reputação" value={getTeacherReputation(materials, preview.author_id)} />}
                <InfoRow label="Downloads" value={String(preview.downloads_count ?? 0)} />
                <InfoRow label="Visualizações" value={String(preview.views_count ?? 0)} />
                <InfoRow label="Avaliações" value={formatRatingSummary(preview)} />
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
              <RatingComments material={preview} />
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
                      href={preview.fileDownloadUrl ?? preview.downloadUrl}
                      onClick={() => void handleDownload(preview)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-app-sm bg-gd py-3 text-[13px] font-bold text-white"
                    >
                      <Download size={15} />
                      Baixar
                    </a>
                  </>
                )}
                {preview.author_id === userId && (
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
  const isDeletable = material.author_id === userId

  async function doDelete(e: MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Excluir este material permanentemente?')) return
    setDeleting(true)
    try {
      await onDelete()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível excluir este material.')
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
        {(material.age_range || material.pedagogical_objective || material.detected_category) && (
          <p className="text-[9px] text-muted line-clamp-1">
            {[material.age_range, material.pedagogical_objective ?? material.detected_category].filter(Boolean).join(' - ')}
          </p>
        )}
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
    subtitle: 'Marque materiais como favoritos para encontrar rapidamente depois.',
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
  const hasExistingRating = Boolean(material.my_rating)

  useEffect(() => {
    setRating(material.my_rating ?? 0)
    setComment(material.my_rating_comment ?? '')
  }, [material.id, material.my_rating, material.my_rating_comment])

  async function submit() {
    if (!rating) return
    setSaving(true)
    try {
      await onRate(material, rating, comment)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar a avaliação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-app-sm border border-border bg-white p-3">
      <p className="text-[12px] font-bold text-ink">{hasExistingRating ? 'Sua avaliação' : 'Avaliar material'}</p>
      {hasExistingRating && (
        <p className="mt-1 text-[11px] leading-[1.5] text-muted">
          Você já avaliou este material. Ajuste as estrelas ou o comentário e salve novamente se quiser atualizar.
        </p>
      )}
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
        placeholder="Comentário opcional sobre sua avaliação"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!rating || saving}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-app-sm bg-gd py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {hasExistingRating ? 'Atualizar avaliação' : 'Salvar avaliação'}
      </button>
    </div>
  )
}

function RatingComments({ material }: { material: SupportMaterial }) {
  const comments = material.rating_comments ?? []

  return (
    <div className="rounded-app-sm border border-border bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold text-ink">Comentários das avaliações</p>
        <span className="text-[11px] text-muted">{comments.length}</span>
      </div>

      {comments.length === 0 ? (
        <p className="mt-2 text-[12px] leading-[1.5] text-muted">
          Ainda não há comentários de avaliação para este material.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {comments.slice(0, 6).map((item, index) => (
            <div key={`${item.author_id ?? 'prof'}-${item.created_at ?? index}`} className="rounded-app-sm bg-cream px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-ink truncate">{item.author_name || 'Professora'}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B7791F]">
                  <Star size={12} fill="currentColor" />
                  {Number(item.rating ?? 0)}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-soft">{item.comment}</p>
            </div>
          ))}
        </div>
      )}
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
      window.alert('Denúncia registrada para moderação.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível registrar a denúncia.')
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
        <option value="imagem_crianca">Imagem de criança</option>
        <option value="conteúdo_inadequado">Conteúdo inadequado</option>
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
      window.alert(error instanceof Error ? error.message : 'Não foi possível excluir este material.')
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
  if (!count) return 'Sem avaliações'
  return `${average.toFixed(1)} estrelas (${count})`
}

function getTeacherReputation(materials: SupportMaterial[], authorId: string) {
  const published = materials.filter((item) => item.author_id === authorId && item.status === 'published')
  const count = published.length
  const average = published.reduce((sum, item) => sum + Number(item.average_rating ?? 0), 0) / Math.max(1, count)
  if (count >= 15 && average >= 4.6) return 'Referência Pedagógica'
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
