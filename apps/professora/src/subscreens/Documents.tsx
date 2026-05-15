import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, FileText, Paperclip, Search, Trash2 } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import type { TeacherPersonalDocument } from '@/types'

const MAX_FILE_BYTES = 4 * 1024 * 1024
const ACCEPTED_TYPES = 'image/*,.pdf,.doc,.docx,.txt,.odt,.rtf'

export default function DocumentsSubscreen(_props?: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const { personalDocuments, addPersonalDocument, removePersonalDocument } = useAppStore()
  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    if (!normalizedQuery) return personalDocuments
    return personalDocuments.filter((doc) => normalizeText(doc.name).includes(normalizedQuery))
  }, [personalDocuments, query])

  async function handleFileSelect(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    setUploadError('')
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('Arquivo muito grande. Use arquivos de até 4 MB.')
      return
    }

    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const doc: TeacherPersonalDocument = {
        id: `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      }
      addPersonalDocument(doc)
    } catch {
      setUploadError('Não foi possível anexar o arquivo. Tente novamente.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
              Guarde aqui certificados de cursos, diplomas, histórico escolar, comprovantes e outros documentos da sua
              trajetória profissional. Eles ficam salvos neste aparelho, com acesso restrito a você.
            </p>
            <p className="text-[11px] text-muted mt-2 leading-[1.5]">
              Formatos: imagens, PDF e documentos de texto. Tamanho máximo por arquivo: 4 MB.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(event) => void handleFileSelect(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-[13px] rounded-app-sm border-[1.5px] border-gp bg-white text-gm font-bold text-[13px] flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
          >
            <Paperclip size={15} />
            {uploading ? 'Anexando...' : 'Anexar documento'}
          </button>

          {uploadError && (
            <p className="text-[12px] text-[#C1440E] mb-4 leading-[1.5]">{uploadError}</p>
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

          {visibleDocuments.length === 0 ? (
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
                <PersonalDocumentRow
                  key={doc.id}
                  doc={doc}
                  onRemove={() => removePersonalDocument(doc.id)}
                />
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
  return (
    <div className="bg-white rounded-app px-[15px] py-[13px] border border-border shadow-card flex items-center gap-[13px]">
      <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center bg-gbg text-gm flex-shrink-0">
        <FileText size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-ink truncate">{doc.name}</p>
        <p className="text-[11px] text-muted">
          {formatFileSize(doc.size)} · {formatDate(doc.uploadedAt)}
        </p>
        <a
          href={doc.dataUrl}
          download={doc.name}
          className="text-[11px] font-bold text-gm mt-1 inline-block"
        >
          Abrir ou baixar
        </a>
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('invalid'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
