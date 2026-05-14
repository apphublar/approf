import { createClient } from '@supabase/supabase-js'

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export function createSupabaseServiceClient() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export async function getAuthenticatedUserId(authorizationHeader: string | null) {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new AiAuthError('Token de autenticacao ausente.')

  const supabase = createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new AiAuthError('Sessao invalida ou expirada.')
  return data.user.id
}

export class AiAuthError extends Error {
  status = 401
}
