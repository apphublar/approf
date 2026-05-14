import { getAppDataMode } from '@/services/app-data'

export function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  }
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig()
  return url.startsWith('https://') && anonKey.length > 20
}

export function isSupabaseAuthEnabled() {
  return getAppDataMode() === 'supabase' && isSupabaseConfigured()
}
