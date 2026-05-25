import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, ImageIcon, Loader2, RefreshCw, UploadCloud } from 'lucide-react'
import {
  analyzeAndUploadMaterial,
  listSupportMaterials,
  type MaterialAnalysisResult,
  type MaterialUploadStatus,
  type SupportMaterial,
} from '@/services/materials'

type MaterialKind = 'document' | 'image'

const ACCEPTED_MATERIALS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',')
const MAX_MATERIAL_SIZE_MB = 10
const MAX_MATERIAL_SIZE_BYTES = MAX_MATERIAL_SIZE_MB * 1024 * 1024

export default function MaterialsScreen() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'analyzing'>('idle')
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [message, setMessage] = useState('')
  const [analysis, setAnalysis] = useState<MaterialAnalysisResult | null>(null)
  const [materials, setMaterials] = useState<SupportMaterial[]>([])

  const materialKind = useMemo(() => file ? getMaterialKind(file) : null, [file])
  const canSubmit = Boolean(title.trim() && description.trim() && file && !submitting)

  useEffect(() => {
    void refreshMaterials()
  }, [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  async function refreshMaterials() {
    setLoadingMaterials(true)
    try {
      setMaterials(await listSupportMaterials())
    } catch {
      setMaterials([])
    } finally {
      setLoadingMaterials(false)
    }
  }

  function selectFile(nextFile?: File | null) {
    if (nextFile && !isAllowedMaterialFile(nextFile)) {
      setFile(null)
      setAnalysis(null)
      setMessage('Apenas documentos e imagens são permitidos em materiais de apoio.')
      return
    }
    if (nextFile && nextFile.size > MAX_MATERIAL_SIZE_BYTES) {
      setFile(null)
      setAnalysis(null)
      setMessage(`O arquivo precisa ter até ${MAX_MATERIAL_SIZE_MB} MB.`)
      return
    }
    setFile(nextFile ?? null)
    setAnalysis(null)
    setMessage('')
  }

  async function submitMaterial() {
    if (!file || !canSubmit) return

    setSubmitting(true)
    setUploadStep('uploading')
    setMessage('')
    setAnalysis(null)
    try {
      window.setTimeout(() => {
        setUploadStep((current) => current === 'uploading' ? 'analyzing' : current)
      }, 800)
      const result = await analyzeAndUploadMaterial({
        title: title.trim(),
        description: description.trim(),
        file,
      })
      setAnalysis(result)
      setMessage(getStatusMessage(result.status))
      setTitle('')
      setDescription('')
      setFile(null)
      await refreshMaterials()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o material.')
    } finally {
      setSubmitting(false)
      setUploadStep('idle')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-[14px] border-b border-border flex-shrink-0">
        <span className="font-serif text-[22px] text-gd">Material de Apoio</span>
        <p className="text-xs text-muted mt-1">Envie documentos e imagens para análise antes de publicar</p>
      </div>

      <div className="scroll-area px-[18px] pb-8">
        <div className="bg-white rounded-app p-4 border border-border shadow-card mt-[14px]">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Novo material</p>

          <label className="block mb-3">
            <span className="block text-[11px] font-bold text-muted mb-1">Tema ou nome do arquivo</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-app-sm border border-border px-3 py-3 text-[13px] outline-none focus:border-gp"
              placeholder="Ex: Sequência didática sobre cores e formas"
            />
          </label>

          <label className="block mb-3">
            <span className="block text-[11px] font-bold text-muted mb-1">Descrição</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full min-h-[96px] resize-none rounded-app-sm border border-border px-3 py-3 text-[13px] leading-[1.5] outline-none focus:border-gp"
              placeholder="Descreva como esse material ajuda na prática pedagógica."
            />
          </label>

          <label className="flex min-h-[136px] cursor-pointer flex-col items-center justify-center rounded-app border border-dashed border-gp bg-gbg px-4 py-5 text-center">
            <UploadCloud size={28} className="text-gm" />
            <span className="mt-2 text-[13px] font-bold text-gd">Adicionar documento ou imagem</span>
            <span className="mt-1 text-[11px] leading-[1.5] text-muted">
              PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP até {MAX_MATERIAL_SIZE_MB} MB
            </span>
            <input
              type="file"
              className="hidden"
              accept={ACCEPTED_MATERIALS}
              onChange={(event) => {
                selectFile(event.target.files?.[0])
                event.currentTarget.value = ''
              }}
            />
          </label>

          {file && (
            <div className="mt-4 rounded-app-sm border border-border bg-cream p-3">
              <div className="mb-3 flex items-center gap-3">
                <MaterialIcon kind={materialKind ?? 'document'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{file.name}</p>
                  <p className="text-[11px] text-muted">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => selectFile(null)} className="text-[11px] font-bold text-[#C1440E]">
                  remover
                </button>
              </div>
              <MaterialPreview file={file} previewUrl={previewUrl} kind={materialKind ?? 'document'} />
            </div>
          )}

          {message && (
            <p className="mt-4 rounded-app-sm border border-gp bg-gbg px-3 py-3 text-[12px] leading-[1.5] text-gd">
              {message}
            </p>
          )}

          {analysis && (
            <div className="mt-4 rounded-app-sm border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-bold text-ink">Análise da IA</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getStatusClass(analysis.status)}`}>
                  {formatStatus(analysis.status)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted">Confiança: {Math.round(analysis.review.confianca * 100)}%</p>
              <p className="mt-1 text-[11px] text-muted">Categoria detectada: {analysis.review.categoria_detectada}</p>
              {analysis.review.motivo && (
                <p className="mt-2 text-[12px] leading-[1.5] text-soft">{analysis.review.motivo}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void submitMaterial()}
            disabled={!canSubmit}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-app bg-gd py-4 text-[15px] font-bold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {submitting ? (uploadStep === 'uploading' ? 'Enviando arquivo...' : 'Analisando com IA...') : 'Adicionar material'}
          </button>
        </div>

        <div className="mt-4 rounded-app border border-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold text-ink">Materiais enviados</p>
              <p className="mt-1 text-[11px] text-muted">Aprovados aparecem para a comunidade. Pendentes e bloqueados ficam visíveis para acompanhamento.</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshMaterials()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted"
              aria-label="Atualizar materiais"
            >
              {loadingMaterials ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {materials.length ? materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            )) : (
              <p className="rounded-app-sm border border-border bg-cream px-3 py-3 text-[12px] text-muted">
                Nenhum material enviado ainda.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MaterialPreview({ file, previewUrl, kind }: { file: File; previewUrl: string; kind: MaterialKind }) {
  if (kind === 'image') {
    return <img src={previewUrl} alt="" className="max-h-64 w-full rounded-app-sm border border-border object-contain bg-white" />
  }
  return (
    <div className="flex items-center gap-2 rounded-app-sm border border-border bg-white px-3 py-3">
      <FileText size={16} className="text-gm" />
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{file.name}</span>
    </div>
  )
}

function MaterialCard({ material }: { material: SupportMaterial }) {
  const kind = getMaterialKindFromType(material.file_type, material.file_name)
  return (
    <div className="rounded-app-sm border border-border bg-cream p-3">
      <div className="flex items-start gap-3">
        <MaterialIcon kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-bold text-ink">{material.title}</p>
            <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${getStatusClass(material.status ?? 'published')}`}>
              {formatStatus(material.status ?? 'published')}
            </span>
          </div>
          {material.description && <p className="mt-1 text-[11px] leading-[1.45] text-muted">{material.description}</p>}
          <p className="mt-2 text-[10px] text-muted">
            {material.file_name ?? 'Material gerado'}{material.file_size_bytes ? ` • ${formatFileSize(material.file_size_bytes)}` : ''}
          </p>
        </div>
      </div>

      {kind === 'image' && material.downloadUrl && (
        <img src={material.downloadUrl} alt="" className="mt-3 max-h-56 w-full rounded-app-sm border border-border bg-white object-contain" />
      )}

      {material.content_preview && (
        <p className="mt-3 rounded-app-sm border border-border bg-white px-3 py-2 text-[11px] leading-[1.5] text-muted">
          {material.content_preview.slice(0, 260)}
        </p>
      )}

      {material.downloadUrl && (
        <a
          href={material.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-app-sm border border-gp bg-gbg py-2 text-[12px] font-bold text-gd"
        >
          <ExternalLink size={14} />
          Visualizar arquivo
        </a>
      )}
    </div>
  )
}

function MaterialIcon({ kind }: { kind: MaterialKind }) {
  const Icon = kind === 'image' ? ImageIcon : FileText
  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] border border-gp bg-gbg text-gm">
      <Icon size={20} />
    </div>
  )
}

function getMaterialKind(file: File): MaterialKind {
  if (file.type.startsWith('image/')) return 'image'
  return 'document'
}

function getMaterialKindFromType(fileType?: string | null, fileName?: string | null): MaterialKind {
  if (fileType?.startsWith('image/')) return 'image'
  const name = fileName?.toLowerCase() ?? ''
  if (['.jpg', '.jpeg', '.png', '.webp'].some((extension) => name.endsWith(extension))) return 'image'
  return 'document'
}

function isAllowedMaterialFile(file: File) {
  const name = file.name.toLowerCase()
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return true
  if (['.jpg', '.jpeg', '.png', '.webp'].some((extension) => name.endsWith(extension))) return true
  return ['.pdf', '.docx', '.xlsx', '.pptx'].some((extension) => name.endsWith(extension))
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function formatStatus(status: MaterialUploadStatus) {
  if (status === 'published') return 'Aprovado'
  if (status === 'blocked') return 'Bloqueado'
  return 'Revisão necessária'
}

function getStatusMessage(status: MaterialUploadStatus) {
  if (status === 'published') return 'Material aprovado e publicado com segurança.'
  if (status === 'blocked') return 'Material bloqueado pela análise de segurança e não publicado.'
  return 'Material enviado para revisão antes de ficar disponível.'
}

function getStatusClass(status: MaterialUploadStatus) {
  if (status === 'published') return 'bg-gbg text-gd border border-gp'
  if (status === 'blocked') return 'bg-red-50 text-red-700 border border-red-200'
  return 'bg-[#FFF3CD] text-[#856404] border border-[#EAD58A]'
}
