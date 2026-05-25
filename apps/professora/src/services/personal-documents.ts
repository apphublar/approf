import type { TeacherPersonalDocument } from '@/types'
import { getSupabaseClient } from './supabase/client'

const MAX_PERSONAL_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
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
  if (!token) throw new Error('Voce precisa estar logada para enviar documentos.')

  console.info('[personal-documents] selected file', {
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  })

  const uploadUrlResponse = await fetch(`${getAdminApiUrl()}/api/personal-documents/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
  })
  const uploadUrlPayload = await uploadUrlResponse.json().catch(() => null) as {
    error?: string
    bucket?: string
    path?: string
    token?: string
  } | null

  console.info('[personal-documents] upload-url response', {
    status: uploadUrlResponse.status,
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
      contentType: file.type || 'application/octet-stream',
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
      mimeType: file.type || 'application/octet-stream',
    }),
  })

  if (!created.document) throw new Error('Documento enviado, mas nao foi possivel carregar o registro criado.')
  return created.document
}

export async function deletePersonalDocument(id: string): Promise<void> {
  await callPersonalDocumentsApi<{ ok: boolean }>(`/api/personal-documents/${id}`, { method: 'DELETE' })
}

function validatePersonalDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const allowed =
    ALLOWED_IMAGE_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) {
    throw new Error('Arquivo nao permitido. Envie imagens, PDF ou documentos de texto.')
  }
  if (file.size > MAX_PERSONAL_DOCUMENT_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. Use arquivos de ate 15 MB.')
  }
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

  const payload = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
  console.info('[personal-documents] API response', { url, status: response.status, payload })

  if (!response.ok) throw new Error(payload?.error || 'Nao foi possivel acessar seus documentos agora.')
  if (!payload || typeof payload !== 'object') throw new Error('Resposta invalida ao acessar seus documentos.')
  return payload as T
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de documentos nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}
