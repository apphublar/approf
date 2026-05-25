import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ChevronLeft, FileText, Loader2, Paperclip, Search, Trash2 } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { deletePersonalDocument, listPersonalDocuments, uploadPersonalDocument } from '@/services/personal-documents'
import type { TeacherPersonalDocument } from '@/types'

const ACCEPTED_TYPES = '.pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf'

export default function DocumentsSubscreen(_props?: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const { personalDocuments, removePersonalDocument } = useAppStore()
  const [documents, setDocuments] = useState<TeacherPersonalDocument[]>([])
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [mobileUploadBlocked] = useState(() => isMobileUploadContext())

  useEffect(() => {
    void refreshDocuments()
  }, [])

  useEffect(() => {
    if (loading || personalDocuments.length === 0) return
    void migrateLocalDocuments()
  }, [loading, personalDocuments])

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    if (!normalizedQuery) return documents
    return documents.filter((doc) => normalizeText(doc.name).includes(normalizedQuery))
  }, [documents, query])

  async function refreshDocuments() {
    setLoading(true)
    setLoadError('')
    try {
      setDocuments(await listPersonalDocuments())
    } catch (error) {
      setDocuments([])
      setLoadError(error instanceof Error ? error.message : 'Nao foi possivel carregar seus documentos.')
    } finally {
      setLoading(false)
    }
  }

  async function migrateLocalDocuments() {
    const localOnlyDocuments = personalDocuments.filter((doc) => doc.dataUrl && !doc.filePath && !doc.url)
    if (localOnlyDocuments.length === 0) return

    for (const localDoc of localOnlyDocuments) {
      try {
        const file = dataUrlToFile(localDoc.dataUrl!, localDoc.name, localDoc.mimeType)
        const uploaded = await uploadPersonalDocument(file)
        setDocuments((current) => [uploaded, ...current.filter((doc) => doc.id !== uploaded.id)])
        removePersonalDocument(localDoc.id)
      } catch (error) {
        console.warn('[personal-documents] local migration failed', {
          id: localDoc.id,
          name: localDoc.name,
          error: error instanceof Error ? error.message : error,
        })
      }
    }
  }

  function handleFileSelect(file: File | null) {
    if (!file) {
      return
    }

    setUploadError('')
    setSelectedFile(file)
  }

  async function uploadSelectedDocument() {
    if (!selectedFile || uploading) return
    setUploadError('')
    setUploading(true)
    try {
      const uploaded = await uploadPersonalDocument(selectedFile)
      setDocuments((current) => [uploaded, ...current.filter((doc) => doc.id !== uploaded.id)])
      setSelectedFile(null)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Nao foi possivel anexar o arquivo. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  function onNativeDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const selectedFile = input.files?.[0] ?? null
    handleFileSelect(selectedFile)
    window.setTimeout(() => {
      input.value = ''
    }, 0)
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Excluir este documento permanentemente?')) return
    setUploadError('')
    try {
      await deletePersonalDocument(id)
      setDocuments((current) => current.filter((doc) => doc.id !== id))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Nao foi possivel remover o documento.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Meus documentos</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="py-5">
          <div className="bg-gbg border border-gp rounded-app p-4 mb-4">
            <p className="text-[13px] font-bold text-gd mb-2">Seus arquivos pessoais</p>
            <p className="text-[12px] text-muted leading-[1.6]">
              Guarde aqui certificados de cursos, diplomas, historico escolar, comprovantes e outros documentos da sua
              trajetoria profissional. Eles ficam salvos com seguranca na sua conta e aparecem em todos os seus aparelhos.
            </p>
            <p className="text-[11px] text-muted mt-2 leading-[1.5]">
              Formatos: JPG, PNG, WEBP, PDF, DOCX, XLSX e PPTX. Tamanho maximo por arquivo: 15 MB.
            </p>
          </div>

          {mobileUploadBlocked ? (
            <UploadDesktopOnlyNotice />
          ) : (
            <div className="mb-4 rounded-app-sm border-[1.5px] border-gp bg-white p-3">
              <label className="flex w-full items-center justify-center gap-2 rounded-app-sm bg-gd px-3 py-3 text-[13px] font-bold text-white">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                {uploading ? 'Anexando...' : 'Escolher arquivo'}
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  disabled={uploading}
                  onChange={(event) => void onNativeDocumentChange(event)}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {(uploadError || loadError) && (
            <p className="text-[12px] text-[#C1440E] mb-4 leading-[1.5]">{uploadError || loadError}</p>
          )}

          {selectedFile && (
            <div className="mb-4 rounded-app-sm border border-border bg-white p-3">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-gm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{selectedFile.name}</p>
                  <p className="text-[11px] text-muted">{formatFileSize(selectedFile.size)} - {selectedFile.type || 'MIME vazio'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void uploadSelectedDocument()}
                disabled={uploading}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-app-sm bg-gd py-3 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                {uploading ? 'Enviando arquivo...' : 'Adicionar arquivo'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
            <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
              <Search size={16} className="text-muted flex-shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome do arquivo..."
                className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
              <Loader2 size={24} className="text-gm mx-auto mb-2 animate-spin" />
              <p className="text-[13px] font-bold text-ink">Carregando documentos...</p>
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
              <FileText size={24} className="text-gm mx-auto mb-2" />
              <p className="text-[13px] font-bold text-ink">Nenhum documento anexado</p>
              <p className="text-[12px] text-muted mt-1 leading-[1.5]">
                Toque em &quot;Anexar documento&quot; para guardar certificados, diplomas ou outros arquivos importantes.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-[9px] pb-8">
              {visibleDocuments.map((doc) => (
                <PersonalDocumentRow key={doc.id} doc={doc} onRemove={() => void handleRemove(doc.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PersonalDocumentRow({
  doc,
  onRemove,
}: {
  doc: TeacherPersonalDocument
  onRemove: () => void
}) {
  const fileUrl = doc.url ?? doc.dataUrl ?? ''
  return (
    <div className="bg-white rounded-app px-[15px] py-[13px] border border-border shadow-card flex items-center gap-[13px]">
      <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center bg-gbg text-gm flex-shrink-0">
        <FileText size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-ink truncate">{doc.name}</p>
        <p className="text-[11px] text-muted">
          {formatFileSize(doc.size)} - {formatDate(doc.uploadedAt)}
        </p>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            download={doc.dataUrl ? doc.name : undefined}
            className="text-[11px] font-bold text-gm mt-1 inline-block"
          >
            Abrir ou baixar
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white flex-shrink-0"
        aria-label="Remover documento"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string) {
  const [header, base64] = dataUrl.split(',')
  if (!base64) throw new Error('Arquivo local invalido.')
  const detectedMime = /data:(.*?);base64/.exec(header)?.[1] || mimeType || 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], fileName, { type: detectedMime })
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function UploadDesktopOnlyNotice() {
  return (
    <div className="mb-4 rounded-app-sm border border-gp bg-gbg px-4 py-4">
      <p className="text-[13px] font-bold text-gd">Envio disponível pelo computador</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-muted">
        Para proteger seus arquivos pessoais, o envio de documentos deve ser feito pelo computador. Pelo celular, você pode visualizar e baixar seus arquivos normalmente.
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
