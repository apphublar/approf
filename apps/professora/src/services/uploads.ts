import { getSupabaseClient } from './supabase/client'

export type UploadModule = 'material_apoio' | 'meus_documentos'

export interface VisualUploadDebugStep {
  id: string
  label: string
  status: 'running' | 'ok' | 'error'
  detail?: string
}

export async function uploadFileToBackend<T>(input: {
  file: File
  module: UploadModule
  metadata?: Record<string, unknown>
  onDebugStep?: (step: VisualUploadDebugStep) => void
}): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para enviar arquivos.')

  input.onDebugStep?.({
    id: 'file-selected',
    label: 'Arquivo selecionado',
    status: 'ok',
    detail: stringifyDebug(getUploadDiagnostics(input.file)),
  })

  input.onDebugStep?.({ id: 'auth', label: 'Usuária autenticada', status: 'running' })
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    input.onDebugStep?.({ id: 'auth', label: 'Usuária autenticada', status: 'error', detail: error.message })
    throw error
  }
  const token = data.session?.access_token
  const userId = data.session?.user.id
  if (!token) {
    input.onDebugStep?.({ id: 'auth', label: 'Usuária autenticada', status: 'error', detail: 'Token ausente' })
    throw new Error('Sua sessão expirou. Faça login novamente.')
  }
  input.onDebugStep?.({ id: 'auth', label: 'Usuária autenticada', status: 'ok', detail: `userId: ${userId}; token: sim` })

  const endpoint = `${getAdminApiUrl()}/api/uploads`
  const formData = new FormData()
  formData.append('module', input.module)
  formData.append('metadata', JSON.stringify(input.metadata ?? {}))
  formData.append('file', input.file, input.file.name)

  input.onDebugStep?.({
    id: 'api-start',
    label: 'Início do envio',
    status: 'running',
    detail: `${input.module} -> ${endpoint}`,
  })

  console.info('[uploads/frontend]', {
    endpoint,
    module: input.module,
    diagnostics: getUploadDiagnostics(input.file, userId, Boolean(token)),
    metadata: input.metadata ?? {},
  })

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  } catch (fetchError) {
    const message = fetchError instanceof TypeError && /failed to fetch/i.test(fetchError.message)
      ? 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
      : fetchError instanceof Error ? fetchError.message : 'Erro inesperado ao enviar o arquivo.'
    input.onDebugStep?.({
      id: 'api-start',
      label: 'Início do envio',
      status: 'error',
      detail: message,
    })
    throw new Error(message)
  }
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ error?: string } & Record<string, unknown>) | null
  input.onDebugStep?.({
    id: 'api-response',
    label: 'Resposta da API',
    status: response.ok ? 'ok' : 'error',
    detail: stringifyDebug({
      status: response.status,
      ok: response.ok,
      raw: rawBody,
    }),
  })

  const serverDebug = Array.isArray(payload?.debug) ? payload.debug : []
  serverDebug.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const debugItem = item as { id?: unknown; label?: unknown; status?: unknown; detail?: unknown }
    input.onDebugStep?.({
      id: `server-${typeof debugItem.id === 'string' ? debugItem.id : index}`,
      label: typeof debugItem.label === 'string' ? debugItem.label : `Backend ${index + 1}`,
      status: debugItem.status === 'error' ? 'error' : debugItem.status === 'running' ? 'running' : 'ok',
      detail: stringifyDebug(debugItem.detail ?? debugItem),
    })
  })

  console.info('[uploads/frontend] response', {
    endpoint,
    module: input.module,
    status: response.status,
    ok: response.ok,
    raw: rawBody,
    payload,
  })

  if (!response.ok) {
    throw new Error(payload?.error || 'Não foi possível enviar o arquivo. Tente novamente.')
  }
  if (!payload || typeof payload !== 'object') throw new Error('Resposta inválida ao enviar o arquivo.')
  return payload as T
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de uploads não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

function parseJsonBody(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function stringifyDebug(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getUploadDiagnostics(file: File, userId?: string, hasToken?: boolean) {
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
