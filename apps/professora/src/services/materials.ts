import { getSupabaseClient } from './supabase/client'

export type MaterialUploadStatus = 'published' | 'review_required' | 'blocked'

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
  status?: MaterialUploadStatus
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

export async function analyzeAndUploadMaterial(input: {
  title: string
  description: string
  file: File
}): Promise<MaterialAnalysisResult> {
  const upload = await callMaterialsApi<{ bucket: string; path: string; token: string }>('/api/materials/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: input.file.name,
      fileType: input.file.type,
      fileSize: input.file.size,
    }),
  })

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { error: uploadError } = await supabase
    .storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const payload = await callMaterialsApi<Partial<MaterialAnalysisResult>>('/api/materials/analyze-stored', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      fileName: input.file.name,
      fileType: input.file.type,
      fileSize: input.file.size,
      filePath: upload.path,
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
