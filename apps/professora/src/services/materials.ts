import { getSupabaseClient } from './supabase/client'

export type MaterialUploadStatus = 'published' | 'review_required' | 'blocked' | 'em_analise'

export interface MaterialAiReview {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteudo_inadequado: boolean
  possui_imagem_sensivel: boolean
  possui_direito_autoral_suspeito: boolean
  motivo: string
}

export interface MaterialAnalysisResult {
  materialId?: string | null
  status: MaterialUploadStatus
  review: MaterialAiReview
  extractedTextPreview?: string
}

export interface SupportMaterial {
  id: string
  title: string
  description: string | null
  file_name: string | null
  file_type: string | null
  file_size_bytes?: number | null
  mime_type?: string | null
  type?: string | null
  age_range?: string | null
  pedagogical_objective?: string | null
  status?: MaterialUploadStatus
  ai_analysis_status?: string | null
  detected_category: string | null
  content_preview: string | null
  published_at: string | null
  downloadUrl?: string | null
}

export interface GeneratedMaterialPreview {
  title: string
  description: string
  shareableBody: string
  review: MaterialAiReview
}

export interface GeneratedMaterialPublishResult extends GeneratedMaterialPreview {
  materialId: string | null
  status: MaterialUploadStatus
}

const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx']
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function analyzeAndUploadMaterial(input: {
  title: string
  description: string
  file: File
}): Promise<MaterialAnalysisResult> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const userId = data.session?.user.id
  if (!userId) throw new Error('Você precisa estar logada para enviar materiais.')

  const uploaded = await uploadMaterialFile(input.file, userId)

  const payload = await callMaterialsApi<Partial<MaterialAnalysisResult>>('/api/materials/analyze-stored', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      fileName: uploaded.file_name,
      fileType: uploaded.mime_type,
      fileSize: uploaded.file_size,
      filePath: uploaded.file_path,
    }),
  })

  if (!payload.status || !payload.review) {
    throw new Error('Resposta invalida da analise do material.')
  }

  return {
    materialId: payload.materialId,
    status: payload.status,
    review: payload.review,
    extractedTextPreview: payload.extractedTextPreview,
  }
}

export async function uploadMaterialFile(file: File, userId: string): Promise<{
  file_path: string
  signed_url: string | null
  file_name: string
  mime_type: string
  file_size: number
}> {
  validateMaterialFile(file)
  console.info('[materials] selected file', {
    name: file.name,
    type: file.type,
    size: file.size,
    userId,
  })
  const upload = await callMaterialsApi<{ bucket: string; path: string; token: string }>('/api/materials/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }),
  })

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { error: uploadError } = await supabase
    .storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, file, {
      contentType: file.type || 'application/octet-stream',
    })
  console.info('[materials] storage upload response', { path: upload.path, error: uploadError })
  if (uploadError) throw new Error('Não foi possível enviar o arquivo. Verifique o tamanho e tente novamente.')

  return {
    file_path: upload.path,
    signed_url: null,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
  }
}

export async function listSupportMaterials(): Promise<SupportMaterial[]> {
  const payload = await callMaterialsApi<{ materials?: SupportMaterial[] }>('/api/materials', { method: 'GET' })
  return Array.isArray(payload.materials) ? payload.materials : []
}

export async function previewGeneratedMaterialShare(input: {
  reportId: string
  title?: string
  description?: string
}): Promise<GeneratedMaterialPreview> {
  return callMaterialsApi<GeneratedMaterialPreview>('/api/materials/share-generated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'preview', ...input }),
  })
}

export async function publishGeneratedMaterialShare(input: {
  reportId: string
  title: string
  description: string
  shareableBody: string
  review: MaterialAiReview
}): Promise<GeneratedMaterialPublishResult> {
  return callMaterialsApi<GeneratedMaterialPublishResult>('/api/materials/share-generated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'publish', ...input }),
  })
}

function validateMaterialFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const allowed = ALLOWED_IMAGE_MIME_TYPES.includes(file.type)
    || ['.jpg', '.jpeg', '.png', '.webp'].some((extension) => lowerName.endsWith(extension))
    || ALLOWED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) {
    throw new Error('Arquivo não permitido. Envie apenas PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
  }
  if (file.size > MAX_MATERIAL_SIZE_BYTES) {
    throw new Error('Não foi possível enviar o arquivo. Verifique o tamanho e tente novamente.')
  }
}

async function callMaterialsApi<T>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de materiais nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel acessar os materiais agora.')
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta invalida ao acessar materiais.')
  }
  return payload as T
}
