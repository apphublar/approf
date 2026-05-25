import { getSupabaseClient } from './supabase/client'
import { uploadFileToBackend, type VisualUploadDebugStep } from './uploads'

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
  author_id?: string | null
  author_name?: string | null
  downloads_count?: number | null
  views_count?: number | null
  ratings_count?: number | null
  average_rating?: number | null
  reports_count?: number | null
  is_favorite?: boolean | null
  my_rating?: number | null
  my_rating_comment?: string | null
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

export interface UploadDebugStep {
  id: string
  label: string
  status: 'running' | 'ok' | 'error'
  detail?: string
}

function toUploadDebugStep(step: VisualUploadDebugStep): UploadDebugStep {
  return step
}

const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx']
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export async function analyzeAndUploadMaterial(input: {
  title: string
  description: string
  file: File
  onDebugStep?: (steps: UploadDebugStep[]) => void
}): Promise<MaterialAnalysisResult> {
  const steps: UploadDebugStep[] = []
  const emit = input.onDebugStep
  const setStep = (id: string, label: string, status: UploadDebugStep['status'], detail?: string) => {
    const existing = steps.findIndex((step) => step.id === id)
    const step: UploadDebugStep = { id, label, status, detail }
    if (existing >= 0) steps[existing] = step
    else steps.push(step)
    emit?.([...steps])
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  setStep('auth', 'Verificando autenticacao', 'running')
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    setStep('auth', 'Verificando autenticacao', 'error', error.message)
    throw error
  }
  const userId = data.session?.user.id
  if (!userId || !data.session?.access_token) {
    setStep('auth', 'Verificando autenticacao', 'error', 'Sessao nao encontrada')
    throw new Error('Voce precisa estar logada para enviar materiais.')
  }
  setStep('auth', 'Verificando autenticacao', 'ok', `userId: ${userId}; token: sim`)
  console.info('[materials/mobile-diagnostics]', getMobileUploadDiagnostics(input.file, userId, true))

  setStep('upload', 'Enviando arquivo', 'running')
  try {
    const payload = await uploadFileToBackend<Partial<MaterialAnalysisResult> & { error?: string }>({
      module: 'material_apoio',
      file: input.file,
      metadata: {
        title: input.title,
        description: input.description,
      },
      onDebugStep: (step) => {
        const normalized = toUploadDebugStep(step)
        const existing = steps.findIndex((item) => item.id === normalized.id)
        if (existing >= 0) steps[existing] = normalized
        else steps.push(normalized)
        emit?.([...steps])
      },
    })
    if (!payload?.status || !payload.review) throw new Error('Resposta invalida da analise do material.')
    setStep('upload', 'Arquivo enviado e aguardando analise', 'ok', `status: ${payload.status}`)
    return {
      materialId: payload.materialId,
      status: payload.status,
      review: payload.review,
      extractedTextPreview: payload.extractedTextPreview,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel enviar o arquivo. Tente novamente.'
    setStep('upload', 'Enviando arquivo', 'error', message)
    throw error
  }
}

export async function uploadMaterialFile(
  file: File,
  userId: string,
  onProgress?: (detail: string) => void,
): Promise<{
  file_path: string
  signed_url: string | null
  file_name: string
  mime_type: string
  file_size: number
}> {
  validateMaterialFile(file)

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

  const uploadUrlEndpoint = `${getAdminApiUrl()}/api/materials/upload-url`
  onProgress?.(`chamando ${uploadUrlEndpoint}`)
  console.info('[materials] calling upload-url', {
    uploadUrlEndpoint,
    diagnostics: getMobileUploadDiagnostics(file, userId, true),
  })

  const uploadUrlResponse = await fetch(uploadUrlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
  })
  const rawUploadUrlBody = await uploadUrlResponse.text().catch((error) => `__READ_ERROR__:${String(error)}`)
  const uploadUrlBody = parseJsonBody(rawUploadUrlBody) as ({ error?: string; bucket?: string; path?: string; token?: string }) | null
  console.info('[materials] upload-url response', {
    status: uploadUrlResponse.status,
    ok: uploadUrlResponse.ok,
    raw: rawUploadUrlBody,
    body: uploadUrlBody,
  })

  if (!uploadUrlResponse.ok) {
    throw new Error(uploadUrlBody?.error || `Falha ao obter URL de upload (HTTP ${uploadUrlResponse.status})`)
  }

  const bucket = uploadUrlBody?.bucket
  const path = uploadUrlBody?.path
  const signedToken = uploadUrlBody?.token
  if (!bucket || !path || !signedToken) throw new Error('Resposta incompleta da rota de upload.')

  onProgress?.(`enviando para storage: ${bucket}/${path}`)
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .uploadToSignedUrl(path, signedToken, fileBuffer, {
      contentType: file.type || inferMimeType(file.name),
    })

  console.info('[materials] storage uploadToSignedUrl result', {
    bucket,
    path,
    uploadError: uploadError ? { message: uploadError.message, status: (uploadError as { status?: number }).status } : null,
  })
  if (uploadError) throw new Error(`Falha no upload ao storage: ${uploadError.message}`)

  onProgress?.('upload concluido')
  return {
    file_path: path,
    signed_url: null,
    file_name: file.name,
    mime_type: file.type || inferMimeType(file.name),
    file_size: file.size,
  }
}

export async function listSupportMaterials(): Promise<SupportMaterial[]> {
  const payload = await callMaterialsApi<{ materials?: SupportMaterial[] }>('/api/materials', { method: 'GET' })
  return Array.isArray(payload.materials) ? payload.materials : []
}

export async function deleteMaterial(id: string): Promise<void> {
  await callMaterialsApi<{ ok: boolean }>(`/api/materials/${id}`, { method: 'DELETE' })
}

export async function registerMaterialView(id: string): Promise<void> {
  await materialAction(id, { action: 'view' })
}

export async function registerMaterialDownload(id: string): Promise<void> {
  await materialAction(id, { action: 'download' })
}

export async function setMaterialFavorite(id: string, favorite: boolean): Promise<void> {
  await materialAction(id, { action: 'favorite', favorite })
}

export async function rateMaterial(id: string, rating: number, comment: string): Promise<void> {
  await materialAction(id, { action: 'rate', rating, comment })
}

export async function reportMaterial(id: string, reason: string, details: string): Promise<void> {
  await materialAction(id, { action: 'report', reason, details })
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
  const mimeType = file.type.toLowerCase()
  const allowed = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)
    || mimeType === 'application/pdf'
    || ['.jpg', '.jpeg', '.png', '.webp'].some((extension) => lowerName.endsWith(extension))
    || ALLOWED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) {
    throw new Error('Arquivo nao permitido. Envie apenas PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
  }
  if (file.size > MAX_MATERIAL_SIZE_BYTES) {
    throw new Error('Nao foi possivel enviar o arquivo. Verifique o tamanho e tente novamente.')
  }
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de materiais nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

async function callMaterialsApi<T>(path: string, init: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

  const fullUrl = `${getAdminApiUrl()}${path}`
  console.info('[materials] API call', { method: init.method, url: fullUrl })
  const response = await fetch(fullUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ error?: string } & Record<string, unknown>) | null
  console.info('[materials] API response', { url: fullUrl, status: response.status, ok: response.ok, raw: rawBody, payload })

  if (!response.ok) throw new Error(payload?.error || 'Nao foi possivel acessar os materiais agora.')
  if (!payload || typeof payload !== 'object') throw new Error('Resposta invalida ao acessar materiais.')
  return payload as T
}

async function materialAction(id: string, body: Record<string, unknown>) {
  await callMaterialsApi<{ ok: boolean }>(`/api/materials/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function inferMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.webp')) return 'image/webp'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lowerName.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
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
