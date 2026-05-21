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

export interface TeacherAccountSnapshot {
  userId: string
  fullName: string
  email: string
  phone: string | null
  schools: Array<{ id: string; name: string; city: string | null; state: string | null }>
  subscription: {
    id: string
    status: TeacherSubscriptionStatus
    plan: string
    provider?: string
    currentPeriodEnd: string | null
    trialExpiresAt: string | null
  } | null
  verifications: TeacherVerificationRequest[]
}

const SUBSCRIPTION_EVENT = 'approf-subscription-state-change'

export async function getTeacherAccountSnapshot(): Promise<TeacherAccountSnapshot> {
  const response = await callAccountApi<{
    profile: { id: string; full_name: string; email: string; phone: string | null } | null
    schools: Array<{ id: string; name: string; city: string | null; state: string | null }>
    subscription: {
      id: string
      status: TeacherSubscriptionStatus
      plan: string
      provider?: string
      current_period_end: string | null
      trial_expires_at: string | null
    } | null
    verifications: TeacherVerificationRequest[]
  }>('/api/account', { method: 'GET' })

  if (!response.profile?.id) throw new Error('Sessao nao encontrada.')
  return {
    userId: response.profile.id,
    fullName: response.profile.full_name ?? 'Professora',
    email: response.profile.email ?? '',
    phone: response.profile.phone ?? null,
    schools: response.schools ?? [],
    subscription: response.subscription
      ? {
          id: response.subscription.id,
          status: response.subscription.status,
          plan: response.subscription.plan,
          provider: response.subscription.provider,
          currentPeriodEnd: response.subscription.current_period_end ?? null,
          trialExpiresAt: response.subscription.trial_expires_at ?? null,
        }
      : null,
    verifications: (response.verifications ?? []).map((item) => ({
      ...item,
      documents: Array.isArray(item.documents) ? item.documents : [],
    })),
  }
}

export async function updateTeacherProfile(input: { fullName?: string; phone?: string | null }) {
  await callAccountApi('/api/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: input.fullName,
      phone: input.phone,
    }),
  })
}

export async function cancelTeacherSubscription() {
  await callAccountApi('/api/account/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SUBSCRIPTION_EVENT))
  }
}

export async function uploadTeacherVerificationDocuments(files: File[]) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('Sessao nao encontrada.')

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
    if (error) throw toError(error, 'Nao foi possivel enviar o documento de verificacao.')

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
}

export async function logoutTeacher() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  await supabase.auth.signOut()
}

export function isTeacherAccessBlocked(status: TeacherSubscriptionStatus | null) {
  if (!status) return false
  return status === 'overdue' || status === 'blocked' || status === 'canceled'
}

export function onSubscriptionStateChange(listener: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SUBSCRIPTION_EVENT, listener)
  return () => window.removeEventListener(SUBSCRIPTION_EVENT, listener)
}

async function callAccountApi<T = Record<string, unknown>>(path: string, init: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend administrativo nao configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao configurado.')

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

  const payload = await response.json().catch(() => null) as { error?: string } | T | null
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Falha ao processar solicitação da conta.'
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

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
