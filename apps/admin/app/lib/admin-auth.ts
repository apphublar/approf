import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { canAccessAdmin } from '@approf/auth'
import type { AppRole } from '@approf/types'

export const ADMIN_ACCESS_COOKIE = 'approf-admin-access-token'

export interface AdminSession {
  userId: string
  role: AppRole
  email: string | null
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Supabase não configurado para o painel admin.')
  }
  return { url, anonKey }
}

export async function validateAdminAccessToken(accessToken: string): Promise<AdminSession | null> {
  const token = accessToken.trim()
  if (!token) return null

  const { url, anonKey } = getSupabaseEnv()
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return null

  const profileClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: profile, error: profileError } = await profileClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile || !canAccessAdmin(profile.role)) return null

  return {
    userId: userData.user.id,
    role: profile.role,
    email: userData.user.email ?? null,
  }
}

export async function getAdminSessionFromCookies(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value
  if (!token) return null
  return validateAdminAccessToken(token)
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSessionFromCookies()
  if (!session) redirect('/login')
  return session
}
