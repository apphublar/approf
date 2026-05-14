import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig, isSupabaseConfigured } from './config'

let client: SupabaseClient | null = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null
  if (client) return client

  const { url, anonKey } = getSupabaseConfig()
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
