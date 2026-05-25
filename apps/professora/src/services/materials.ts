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

export interface UploadDebugStep {
  id: string
  label: string
  status: 'running' | 'ok' | 'error'
  detail?: string
}

const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx']
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function analyzeAndUploadMaterial(input: {
  title: string
  description: string
  file: File
  onDebugStep?: (steps: UploadDebugStep[]) => void
}): Promise<MaterialAnalysisResult> {
  const steps: UploadDebugStep[] = []
  const emit = input.onDebugStep

  function setStep(id: string, label: string, status: UploadDebugStep['status'], detail?: string) {
    const existing = steps.findIndex((s) => s.id === id)
    const step: UploadDebugStep = { id, label, status, detail }
    if (existing >= 0) steps[existing] = step
    else steps.push(step)
    emit?.([...steps])
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  // Step: auth
  setStep('auth', 'Verificando autenticação', 'running')
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    setStep('auth', 'Verificando autenticação', 'error', error.message)
    throw error
  }
  const userId = data.session?.user.id
  if (!userId) {
    setStep('auth', 'Verificando autenticação', 'error', 'Sessão não encontrada')
    throw new Error('Você precisa estar logada para enviar materiais.')
  }
  setStep('auth', 'Verificando autenticação', 'ok', `userId: ${userId}`)

  // Step: upload to storage
  setStep('storage', 'Enviando arquivo para storage', 'running')
  let uploaded: Awaited<ReturnType<typeof uploadMaterialFile>>
  try {
    uploaded = await uploadMaterialFile(input.file, userId, (detail) => {
      setStep('storage', 'Enviando arquivo para storage', 'running', detail)
    })
    setStep('storage', 'Enviando arquivo para storage', 'ok', `path: ${uploaded.file_path}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido no upload'
    setStep('storage', 'Enviando arquivo para storage', 'error', msg)
    throw err
  }

  // Step: analyze
  setStep('analyze', 'Registrando e analisando com IA', 'running')
  let payload: Partial<MaterialAnalysisResult>
  try {
    const apiBaseUrl = getAdminApiUrl()
    const token = data.session?.access_token
    if (!token) throw new Error('Token de sessao nao encontrado.')

    const analyzeUrl = `${apiBaseUrl}/api/materials/analyze-stored`
    console.info('[materials] calling analyze-stored', { analyzeUrl, filePath: uploaded.file_path })

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        fileName: uploaded.file_name,
        fileType: uploaded.mime_type,
        fileSize: uploaded.file_size,
        filePath: uploaded.file_path,
      }),
    })

    const responseBody = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
    console.info('[materials] analyze-stored response', { status: response.status, body: responseBody })

    if (!response.ok) {
      const msg = responseBody?.error || `HTTP ${response.status}`
      setStep('analyze', 'Registrando e analisando com IA', 'error', msg)
      throw new Error(msg)
    }
    if (!responseBody || typeof responseBody !== 'object') {
      setStep('analyze', 'Registrando e analisando com IA', 'error', 'Resposta invalida do servidor')
      throw new Error('Resposta invalida ao acessar materiais.')
    }
    payload = responseBody as Partial<MaterialAnalysisResult>
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na analise'
    setStep('analyze', 'Registrando e analisando com IA', 'error', msg)
    throw err
  }

  if (!payload.status || !payload.review) {
    setStep('analyze', 'Registrando e analisando com IA', 'error', 'Resposta invalida da analise')
    throw new Error('Resposta invalida da analise do material.')
  }

  setStep('analyze', 'Registrando e analisando com IA', 'ok', `status: ${payload.status}`)

  return {
    materialId: payload.materialId,
    status: payload.status,
    review: payload.review,
    extractedTextPreview: payload.extractedTextPreview,
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

  const apiBaseUrl = getAdminApiUrl()
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

  // Step A: get signed URL
  const uploadUrlEndpoint = `${apiBaseUrl}/api/materials/upload-url`
  onProgress?.(`chamando ${uploadUrlEndpoint}`)
  console.info('[materials] calling upload-url', {
    uploadUrlEndpoint,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    userId,
  })

  const uploadUrlResponse = await fetch(uploadUrlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
  })

  const uploadUrlBody = await uploadUrlResponse.json().catch(() => null) as ({ error?: string; bucket?: string; path?: string; token?: string }) | null
  console.info('[materials] upload-url response', { status: uploadUrlResponse.status, body: uploadUrlBody })

  if (!uploadUrlResponse.ok) {
    throw new Error(uploadUrlBody?.error || `Falha ao obter URL de upload (HTTP ${uploadUrlResponse.status})`)
  }

  const bucket = uploadUrlBody?.bucket
  const path = uploadUrlBody?.path
  const signedToken = uploadUrlBody?.token

  if (!bucket || !path || !signedToken) {
    console.error('[materials] upload-url returned incomplete data', uploadUrlBody)
    throw new Error('Resposta incompleta da rota de upload.')
  }

  onProgress?.(`enviando para storage: ${bucket}/${path}`)
  console.info('[materials] uploading to storage via signed URL', { bucket, path })

  // Step B: upload to storage
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .uploadToSignedUrl(path, signedToken, file, {
      contentType: file.type || 'application/octet-stream',
    })

  console.info('[materials] storage uploadToSignedUrl result', {
    bucket,
    path,
    uploadError: uploadError ? { message: uploadError.message, status: (uploadError as { status?: number }).status } : null,
  })

  if (uploadError) {
    throw new Error(`Falha no upload ao storage: ${uploadError.message}`)
  }

  onProgress?.('upload concluido')
  return {
    file_path: path,
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

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de materiais nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

async function callMaterialsApi<T>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = getAdminApiUrl()
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar materiais.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessao expirada. Entre novamente.')

  const fullUrl = `${apiBaseUrl}${path}`
  console.info('[materials] API call', { method: init.method, url: fullUrl })

  const response = await fetch(fullUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
  console.info('[materials] API response', { url: fullUrl, status: response.status, payload })

  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel acessar os materiais agora.')
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta invalida ao acessar materiais.')
  }
  return payload as T
}
