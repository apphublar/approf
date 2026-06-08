import { getSupabaseClient } from './client'

export type TeacherSubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

export interface VerificationDocument {
  path: string
  fileName: string
  mimeType: string
  size: number
}

export interface TeacherVerificationRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  school_ids: string[]
  notes: string | null
  documents: VerificationDocument[]
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  app: {
    relatoriosPendentes: boolean
    sugestoesIA: boolean
    streakRisco: boolean
    novidades: boolean
  }
  email: {
    resumoSemanal: boolean
    pagamento: boolean
  }
  silencio: {
    ativo: boolean
    inicio: string
    fim: string
  }
}

export interface TeacherAccountSnapshot {
  userId: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  schoolLogoUrl: string | null
  notificationPreferences: NotificationPreferences
  schools: Array<{ id: string; name: string; city: string | null; state: string | null }>
  subscription: {
    id: string
    status: TeacherSubscriptionStatus
    plan: string
    provider?: string
    currentPeriodEnd: string | null
    trialExpiresAt: string | null
    externalReference: string | null
  } | null
  verifications: TeacherVerificationRequest[]
  notices: Array<{
    id: string
    type: string
    createdAt: string
    title: string
    message: string
  }>
}

const SUBSCRIPTION_EVENT = 'approf-subscription-state-change'
const ACCOUNT_CACHE_MAX_AGE_MS = 60_000
let teacherAccountCache: { value: TeacherAccountSnapshot; fetchedAt: number } | null = null
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  app: {
    relatoriosPendentes: true,
    sugestoesIA: true,
    streakRisco: true,
    novidades: false,
  },
  email: {
    resumoSemanal: true,
    pagamento: true,
  },
  silencio: {
    ativo: true,
    inicio: '22:00',
    fim: '06:00',
  },
}

export async function getTeacherAccountSnapshot(options?: { forceRefresh?: boolean }): Promise<TeacherAccountSnapshot> {
  if (!options?.forceRefresh && teacherAccountCache) {
    const age = Date.now() - teacherAccountCache.fetchedAt
    if (age <= ACCOUNT_CACHE_MAX_AGE_MS) {
      return teacherAccountCache.value
    }
  }

  const response = await callAccountApi<{
    profile: {
      id: string
      full_name: string
      email: string
      phone: string | null
      avatar_url?: string | null
      notification_preferences?: NotificationPreferences
    } | null
    schools: Array<{ id: string; name: string; city: string | null; state: string | null }>
    subscription: {
      id: string
      status: TeacherSubscriptionStatus
      plan: string
      provider?: string
      current_period_end: string | null
      trial_expires_at: string | null
      external_reference: string | null
    } | null
    verifications: TeacherVerificationRequest[]
    notices?: Array<{
      id: string
      type: string
      created_at: string
      payload?: {
        title?: string
        message?: string
      }
    }>
  }>('/api/account', { method: 'GET' })

  if (!response.profile?.id) throw new Error('Sessão não encontrada.')
  const snapshot: TeacherAccountSnapshot = {
    userId: response.profile.id,
    fullName: response.profile.full_name ?? 'Professora',
    email: response.profile.email ?? '',
    phone: response.profile.phone ?? null,
    avatarUrl: response.profile.avatar_url ?? null,
    schoolLogoUrl: (response.profile as Record<string, unknown>).school_logo_url as string | null ?? null,
    notificationPreferences: sanitizeNotificationPreferences(response.profile.notification_preferences),
    schools: response.schools ?? [],
    subscription: response.subscription
      ? {
          id: response.subscription.id,
          status: response.subscription.status,
          plan: response.subscription.plan,
          provider: response.subscription.provider,
          currentPeriodEnd: response.subscription.current_period_end ?? null,
          trialExpiresAt: response.subscription.trial_expires_at ?? null,
          externalReference: response.subscription.external_reference ?? null,
        }
      : null,
    verifications: (response.verifications ?? []).map((item) => ({
      ...item,
      documents: Array.isArray(item.documents) ? item.documents : [],
    })),
    notices: (response.notices ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      createdAt: item.created_at,
      title: item.payload?.title || 'Aviso importante',
      message: item.payload?.message || 'Há uma atualização importante na sua conta.',
    })),
  }
  teacherAccountCache = { value: snapshot, fetchedAt: Date.now() }
  return snapshot
}

export function getCachedTeacherAccountSnapshot() {
  return teacherAccountCache?.value ?? null
}

export async function preloadTeacherAccountSnapshot() {
  try {
    await getTeacherAccountSnapshot()
  } catch {
    // Silent preload failure: menu can still load normally.
  }
}

export async function updateTeacherProfile(input: {
  fullName?: string
  phone?: string | null
  email?: string
  avatarUrl?: string | null
  schoolLogoUrl?: string | null
  notificationPreferences?: NotificationPreferences
}) {
  await callAccountApi('/api/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      avatarUrl: input.avatarUrl,
      schoolLogoUrl: input.schoolLogoUrl,
      notificationPreferences: input.notificationPreferences,
    }),
  })
  teacherAccountCache = null
}

export async function updateTeacherPassword(input: {
  currentPassword: string
  newPassword: string
  email: string
}) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  if (!input.currentPassword.trim()) throw new Error('Informe a senha atual.')
  if (input.newPassword.trim().length < 8) {
    throw new Error('A nova senha precisa ter no mínimo 8 caracteres.')
  }
  if (!/[0-9]/.test(input.newPassword) || !/[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|]/.test(input.newPassword)) {
    throw new Error('A nova senha precisa ter ao menos 1 número e 1 caractere especial.')
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.currentPassword,
  })
  if (signInError) throw new Error('Senha atual incorreta.')

  const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  if (error) throw error
}

export async function uploadSchoolLogo(file: File) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('Sessão não encontrada.')

  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}/school-logo.${extension}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/png',
  })
  if (error) throw toError(error, 'Não foi possível enviar o logo da escola.')

  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
  return publicData.publicUrl
}

export async function cancelTeacherSubscription() {
  await callAccountApi('/api/account/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  })
  teacherAccountCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SUBSCRIPTION_EVENT))
  }
}

export async function uploadTeacherVerificationDocuments(files: File[]) {
  try {
    const response = await callAccountApiForm<{ documents: VerificationDocument[] }>('/api/account/verification/upload', files)
    const docs = Array.isArray(response.documents) ? response.documents : []
    if (!docs.length) throw new Error('Nenhum documento foi processado para verificação.')
    return docs
  } catch (apiError) {
    // Fallback local em caso de falha do endpoint (ambiente antigo sem rota nova).
    return uploadTeacherVerificationDocumentsDirect(files, apiError)
  }
}

async function uploadTeacherVerificationDocumentsDirect(files: File[], originalError?: unknown) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('Sessão não encontrada.')

  const uploaded: VerificationDocument[] = []
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const sanitized = sanitizeFileName(file.name, extension)
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitized}`

    const { error } = await supabase.storage.from('profile-verification').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (error) {
      const cause = originalError instanceof Error ? ` (${originalError.message})` : ''
      throw toError(error, `Não foi possível enviar o documento de verificação.${cause}`)
    }

    uploaded.push({
      path,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    })
  }
  return uploaded
}

export async function submitTeacherVerificationRequest(input: {
  schoolIds: string[]
  notes?: string
  documents: VerificationDocument[]
}) {
  await callAccountApi('/api/account/verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  teacherAccountCache = null
}

export async function logoutTeacher() {
  const supabase = getSupabaseClient()
  teacherAccountCache = null
  if (!supabase) return
  await supabase.auth.signOut()
}

export function isTeacherAccessBlocked(status: TeacherSubscriptionStatus | null) {
  if (!status) return false
  return status === 'blocked'
}

export function onSubscriptionStateChange(listener: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SUBSCRIPTION_EVENT, listener)
  return () => window.removeEventListener(SUBSCRIPTION_EVENT, listener)
}

async function callAccountApi<T = Record<string, unknown>>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend administrativo não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as { error?: string } | T | null
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Falha ao processar solicitação da conta.'
    throw new Error(message)
  }

  return (payload ?? {}) as T
}

async function callAccountApiForm<T = Record<string, unknown>>(path: string, files: File[]): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend administrativo não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  const formData = new FormData()
  files.slice(0, 10).forEach((file) => formData.append('files', file))

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => null) as { error?: string } | T | null
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Falha ao processar upload de documentos.'
    throw new Error(message)
  }

  return (payload ?? {}) as T
}

function sanitizeFileName(fileName: string, fallbackExtension: string) {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  if (!sanitized) return `arquivo.${fallbackExtension}`
  return sanitized.includes('.') ? sanitized : `${sanitized}.${fallbackExtension}`
}

function sanitizeNotificationPreferences(value?: NotificationPreferences): NotificationPreferences {
  const candidate = value ?? DEFAULT_NOTIFICATION_PREFERENCES
  return {
    app: {
      relatoriosPendentes: candidate.app?.relatoriosPendentes ?? true,
      sugestoesIA: candidate.app?.sugestoesIA ?? true,
      streakRisco: candidate.app?.streakRisco ?? true,
      novidades: candidate.app?.novidades ?? false,
    },
    email: {
      resumoSemanal: candidate.email?.resumoSemanal ?? true,
      pagamento: true,
    },
    silencio: {
      ativo: candidate.silencio?.ativo ?? true,
      inicio: candidate.silencio?.inicio ?? '22:00',
      fim: candidate.silencio?.fim ?? '06:00',
    },
  }
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
