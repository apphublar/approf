import { getSupabaseClient } from './supabase/client'
import { uploadFileToBackend, type VisualUploadDebugStep } from './uploads'

export type MaterialUploadStatus = 'published' | 'review_required' | 'blocked' | 'em_analise'

export interface MaterialAiReview {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteúdo_inadequado: boolean
  possui_imagem_sensível: boolean
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
  fileDownloadUrl?: string | null
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
  rating_comments?: MaterialRatingComment[]
}

export interface MaterialRatingComment {
  rating: number
  comment: string
  author_id?: string | null
  author_name?: string | null
  created_at?: string | null
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
  ageRange?: string
  pedagogicalObjective?: string
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

  validateMaterialFile(input.file)

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar materiais.')

  setStep('auth', 'Verificando autenticação', 'running')
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    setStep('auth', 'Verificando autenticação', 'error', error.message)
    throw error
  }
  const userId = data.session?.user.id
  if (!userId || !data.session?.access_token) {
    setStep('auth', 'Verificando autenticação', 'error', 'Sessão não encontrada')
    throw new Error('Você precisa estar logada para enviar materiais.')
  }
  setStep('auth', 'Verificando autenticação', 'ok', `userId: ${userId}; token: sim`)
  console.info('[materials/mobile-diagnostics]', getMobileUploadDiagnostics(input.file, userId, true))

  setStep('upload', 'Enviando arquivo', 'running')
  try {
    const payload = await uploadFileToBackend<Partial<MaterialAnalysisResult> & { error?: string }>({
      module: 'material_apoio',
      file: input.file,
      metadata: {
        title: input.title,
        description: input.description,
        ageRange: input.ageRange,
        pedagogicalObjective: input.pedagogicalObjective,
      },
      onDebugStep: (step) => {
        const normalized = toUploadDebugStep(step)
        const existing = steps.findIndex((item) => item.id === normalized.id)
        if (existing >= 0) steps[existing] = normalized
        else steps.push(normalized)
        emit?.([...steps])
      },
    })
    if (!payload?.status || !payload.review) throw new Error('Resposta inválida da análise do material.')
    setStep('upload', 'Arquivo enviado e aguardando análise', 'ok', `status: ${payload.status}`)
    return {
      materialId: payload.materialId,
      status: payload.status,
      review: payload.review,
      extractedTextPreview: payload.extractedTextPreview,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar o arquivo. Tente novamente.'
    setStep('upload', 'Enviando arquivo', 'error', message)
    throw error
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
    throw new Error('Arquivo não permitido. Envie apenas PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.')
  }
  if (file.size > MAX_MATERIAL_SIZE_BYTES) {
    throw new Error('Não foi possível enviar o arquivo. Verifique o tamanho e tente novamente.')
  }
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de materiais não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

async function callMaterialsApi<T>(path: string, init: RequestInit): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar materiais.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

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

  if (!response.ok) throw new Error(payload?.error || 'Não foi possível acessar os materiais agora.')
  if (!payload || typeof payload !== 'object') throw new Error('Resposta inválida ao acessar materiais.')
  return payload as T
}

async function materialAction(id: string, body: Record<string, unknown>) {
  await callMaterialsApi<{ ok: boolean }>(`/api/materials/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
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
