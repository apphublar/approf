import { getSupabaseClient } from './supabase/client'

export type UploadModule = 'material_apoio' | 'meus_documentos'

export async function uploadFileToBackend<T>(input: {
  file: File
  module: UploadModule
  metadata?: Record<string, unknown>
}): Promise<T> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado para enviar arquivos.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  const userId = data.session?.user.id
  if (!token) throw new Error('Sua sessao expirou. Faca login novamente.')

  const endpoint = `${getAdminApiUrl()}/api/uploads`
  const formData = new FormData()
  formData.append('module', input.module)
  formData.append('metadata', JSON.stringify(input.metadata ?? {}))
  formData.append('file', input.file, input.file.name)

  console.info('[uploads/frontend]', {
    endpoint,
    module: input.module,
    diagnostics: getUploadDiagnostics(input.file, userId, Boolean(token)),
    metadata: input.metadata ?? {},
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const rawBody = await response.text().catch((readError) => `__READ_ERROR__:${String(readError)}`)
  const payload = parseJsonBody(rawBody) as ({ error?: string } & Record<string, unknown>) | null

  console.info('[uploads/frontend] response', {
    endpoint,
    module: input.module,
    status: response.status,
    ok: response.ok,
    raw: rawBody,
    payload,
  })

  if (!response.ok) {
    throw new Error(payload?.error || 'Nao foi possivel enviar o arquivo. Tente novamente.')
  }
  if (!payload || typeof payload !== 'object') throw new Error('Resposta invalida ao enviar o arquivo.')
  return payload as T
}

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de uploads nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

function parseJsonBody(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
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
