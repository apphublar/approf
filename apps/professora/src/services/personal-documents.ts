import type { TeacherPersonalDocument } from '@/types'
import { isMobileDevice } from '@/utils/device'
import { getSupabaseClient } from './supabase/client'
import { uploadFileToBackend, type VisualUploadDebugStep } from './uploads'

const MAX_PERSONAL_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx', '.pptx']
const PERSONAL_DOCUMENT_BUCKET = 'teacher-documents'

export async function listPersonalDocuments(): Promise<TeacherPersonalDocument[]> {
  const payload = await callPersonalDocumentsApi<{ documents?: TeacherPersonalDocument[] }>('/api/personal-documents', {
    method: 'GET',
  })
  return Array.isArray(payload.documents) ? payload.documents : []
}

export async function uploadPersonalDocument(
  file: File,
  onDebugStep?: (step: VisualUploadDebugStep) => void,
): Promise<TeacherPersonalDocument> {
  validatePersonalDocumentFile(file)

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar documentos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  const userId = data.session?.user.id
  if (!token || !userId) throw new Error('Você precisa estar logada para enviar documentos.')

  console.info('[personal-documents/mobile-diagnostics]', getMobileUploadDiagnostics(file, userId, Boolean(token)))

  if (isMobileDevice()) {
    try {
      return await uploadPersonalDocumentDirect(file, userId)
    } catch (directError) {
      console.warn('[personal-documents] upload direto falhou, tentando backend', directError)
    }
  }

  try {
    const payload = await uploadFileToBackend<{ document?: TeacherPersonalDocument; error?: string }>({
      module: 'meus_documentos',
      file,
      onDebugStep,
    })
    if (!payload.document) throw new Error('Documento enviado, mas a resposta do servidor foi inválida.')
    return payload.document
  } catch (backendError) {
    console.warn('[personal-documents] upload via backend falhou, tentando direto', backendError)
    return uploadPersonalDocumentDirect(file, userId)
  }
}

async function uploadPersonalDocumentDirect(file: File, userId: string): Promise<TeacherPersonalDocument> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar documentos.')

  const mimeType = inferMimeType(file)
  const filePath = `${userId}/${Date.now()}-${safeFileName(file.name)}`
  const { error: storageError } = await supabase.storage.from(PERSONAL_DOCUMENT_BUCKET).upload(filePath, file, {
    contentType: mimeType,
    upsert: false,
  })
  if (storageError) {
    throw new Error(`Não foi possível salvar o arquivo no storage. ${storageError.message}`)
  }

  const payload = await callPersonalDocumentsApi<{ document?: TeacherPersonalDocument }>('/api/personal-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    }),
  })

  if (!payload.document) throw new Error('Arquivo enviado, mas o registro não foi criado no servidor.')
  return payload.document
}

export async function deletePersonalDocument(id: string): Promise<void> {
  await callPersonalDocumentsApi<{ ok: boolean }>(`/api/personal-documents/${id}`, { method: 'DELETE' })
}

function validatePersonalDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  const allowed = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)
    || mimeType === 'application/pdf'
    || mimeType === 'application/octet-stream'
    || hasAllowedExtension
  if (!allowed) throw new Error('Arquivo não permitido. Envie PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
  if (file.size > MAX_PERSONAL_DOCUMENT_SIZE_BYTES) throw new Error('Arquivo muito grande. Use arquivos de até 15 MB.')
}

function inferMimeType(file: File) {
  if (file.type) return file.type
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lowerName.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  if (lowerName.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

function safeFileName(fileName: string) {
  const normalized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const extension = normalized.split('.').pop()?.replace(/[^a-z0-9]/g, '') || 'bin'
  const base = normalized
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'arquivo'
  return `${base}.${extension}`
}

async function callPersonalDocumentsApi<T>(path: string, init: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar documentos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Você precisa estar logada para acessar seus documentos.')

  const url = `${getAdminApiUrl()}${path}`
  console.info('[personal-documents] API call', { method: init.method, url })
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })
  } catch (error) {
    throw wrapPersonalDocumentsFetchError(error)
  }
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ error?: string } & Record<string, unknown>) | null
  console.info('[personal-documents] API response', { url, status: response.status, ok: response.ok, raw: rawBody, payload })

  if (!response.ok) throw new Error(payload?.error || 'Não foi possível acessar seus documentos agora.')
  if (!payload || typeof payload !== 'object') throw new Error('Resposta inválida ao acessar seus documentos.')
  return payload as T
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de documentos não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

function parseJsonBody(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function wrapPersonalDocumentsFetchError(error: unknown): Error {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')
  }
  return error instanceof Error ? error : new Error('Erro inesperado ao acessar seus documentos.')
}

function getMobileUploadDiagnostics(file: File, userId?: string, hasToken?: boolean) {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const win = typeof window !== 'undefined' ? window : null
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : ''
  return {
    userAgent: nav?.userAgent ?? 'unknown',
    platform: nav?.platform ?? 'unknown',
    origin: win?.location?.origin ?? 'unknown',
    href: win?.location?.href ?? 'unknown',
    standalone: win?.matchMedia?.('(display-mode: standalone)').matches ?? false,
    userId: userId ?? null,
    hasToken: Boolean(hasToken),
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || '(empty)',
    extension,
  }
}
