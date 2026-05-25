import type { TeacherPersonalDocument } from '@/types'
import { getSupabaseClient } from './supabase/client'

const MAX_PERSONAL_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt']

export async function listPersonalDocuments(): Promise<TeacherPersonalDocument[]> {
  const payload = await callPersonalDocumentsApi<{ documents?: TeacherPersonalDocument[] }>('/api/personal-documents', {
    method: 'GET',
  })
  return Array.isArray(payload.documents) ? payload.documents : []
}

export async function uploadPersonalDocument(file: File): Promise<TeacherPersonalDocument> {
  validatePersonalDocumentFile(file)

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar documentos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  const userId = data.session?.user.id
  if (!token) throw new Error('Voce precisa estar logada para enviar documentos.')

  console.info('[personal-documents/mobile-diagnostics]', getMobileUploadDiagnostics(file, userId, Boolean(token)))

  try {
    return await uploadPersonalDocumentSigned(file, token)
  } catch (signedError) {
    console.warn('[personal-documents] signed upload failed, trying backend fallback', {
      error: signedError instanceof Error ? signedError.message : signedError,
    })
    return uploadPersonalDocumentDirect(file, token)
  }
}

export async function deletePersonalDocument(id: string): Promise<void> {
  await callPersonalDocumentsApi<{ ok: boolean }>(`/api/personal-documents/${id}`, { method: 'DELETE' })
}

async function uploadPersonalDocumentSigned(file: File, token: string): Promise<TeacherPersonalDocument> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar documentos.')

  const uploadUrlEndpoint = `${getAdminApiUrl()}/api/personal-documents/upload-url`
  console.info('[personal-documents] calling upload-url', { uploadUrlEndpoint, fileName: file.name, fileType: file.type, fileSize: file.size })
  const uploadUrlResponse = await fetch(uploadUrlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
  })
  const rawUploadUrlBody = await uploadUrlResponse.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const uploadUrlPayload = parseJsonBody(rawUploadUrlBody) as {
    error?: string
    bucket?: string
    path?: string
    token?: string
  } | null
  console.info('[personal-documents] upload-url response', {
    status: uploadUrlResponse.status,
    ok: uploadUrlResponse.ok,
    raw: rawUploadUrlBody,
    payload: uploadUrlPayload,
  })

  if (!uploadUrlResponse.ok) {
    throw new Error(uploadUrlPayload?.error || 'Nao foi possivel preparar o envio do documento.')
  }

  const bucket = uploadUrlPayload?.bucket
  const path = uploadUrlPayload?.path
  const signedToken = uploadUrlPayload?.token
  if (!bucket || !path || !signedToken) throw new Error('Resposta incompleta da rota de upload.')

  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .uploadToSignedUrl(path, signedToken, fileBuffer, {
      contentType: file.type || inferPersonalMimeType(file.name),
    })
  console.info('[personal-documents] storage upload result', {
    bucket,
    path,
    error: uploadError ? uploadError.message : null,
  })
  if (uploadError) throw new Error(`Falha no upload ao storage: ${uploadError.message}`)

  const created = await callPersonalDocumentsApi<{ document?: TeacherPersonalDocument }>('/api/personal-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: path,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || inferPersonalMimeType(file.name),
    }),
  })
  if (!created.document) throw new Error('Documento enviado, mas nao foi possivel carregar o registro criado.')
  return created.document
}

async function uploadPersonalDocumentDirect(file: File, token: string): Promise<TeacherPersonalDocument> {
  const endpoint = `${getAdminApiUrl()}/api/personal-documents/upload-direct`
  const formData = new FormData()
  formData.append('file', file, file.name)
  console.info('[personal-documents] calling upload-direct fallback', { endpoint, fileName: file.name, fileType: file.type, fileSize: file.size })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ document?: TeacherPersonalDocument; error?: string } & Record<string, unknown>) | null
  console.info('[personal-documents] upload-direct response', { status: response.status, ok: response.ok, raw: rawBody, payload })

  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel enviar. Tente novamente usando Wi-Fi ou escolha um arquivo menor.')
  }
  if (!payload?.document) throw new Error('Documento enviado, mas a resposta do servidor foi invalida.')
  return payload.document
}

function validatePersonalDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  const allowed = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)
    || mimeType === 'application/pdf'
    || ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) throw new Error('Arquivo nao permitido. Envie imagens, PDF ou documentos de texto.')
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

function inferPersonalMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.webp')) return 'image/webp'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  if (lowerName.endsWith('.doc')) return 'application/msword'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.odt')) return 'application/vnd.oasis.opendocument.text'
  if (lowerName.endsWith('.rtf')) return 'application/rtf'
  return 'application/octet-stream'
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
