/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPROF_DATA_MODE?: 'mock' | 'supabase'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APPROF_ADMIN_API_URL?: string
  readonly VITE_APPROF_SYNC_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
