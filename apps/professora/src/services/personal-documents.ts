import type { TeacherPersonalDocument } from '@/types'
import { getSupabaseClient } from './supabase/client'
import { uploadFileToBackend, type VisualUploadDebugStep } from './uploads'

const MAX_PERSONAL_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx', '.pptx']

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
  if (!supabase) throw new Error('Supabase nao configurado para enviar documentos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  const userId = data.session?.user.id
  if (!token) throw new Error('Voce precisa estar logada para enviar documentos.')

  console.info('[personal-documents/mobile-diagnostics]', getMobileUploadDiagnostics(file, userId, Boolean(token)))

  const payload = await uploadFileToBackend<{ document?: TeacherPersonalDocument; error?: string }>({
    module: 'meus_documentos',
    file,
    onDebugStep,
  })
  if (!payload.document) throw new Error('Documento enviado, mas a resposta do servidor foi invalida.')
  return payload.document
}

export async function deletePersonalDocument(id: string): Promise<void> {
  await callPersonalDocumentsApi<{ ok: boolean }>(`/api/personal-documents/${id}`, { method: 'DELETE' })
}

function validatePersonalDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  const allowed = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)
    || mimeType === 'application/pdf'
    || ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) throw new Error('Arquivo nao permitido. Envie PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
  if (file.size > MAX_PERSONAL_DOCUMENT_SIZE_BYTES) throw new Error('Arquivo muito grande. Use arquivos de ate 15 MB.')
}

async function callPersonalDocumentsApi<T>(path: string, init: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar documentos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Voce precisa estar logada para acessar seus documentos.')

  const url = `${getAdminApiUrl()}${path}`
  console.info('[personal-documents] API call', { method: init.method, url })
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ error?: string } & Record<string, unknown>) | null
  console.info('[personal-documents] API response', { url, status: response.status, ok: response.ok, raw: rawBody, payload })

  if (!response.ok) throw new Error(payload?.error || 'Nao foi possivel acessar seus documentos agora.')
  if (!payload || typeof payload !== 'object') throw new Error('Resposta invalida ao acessar seus documentos.')
  return payload as T
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de documentos nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

function parseJsonBody(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
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
