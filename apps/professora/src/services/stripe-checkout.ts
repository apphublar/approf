import { getSupabaseClient } from '@/services/supabase/client'
import type { SignupPlan } from '@/services/supabase/auth'

function getAdminApiUrl() {
  const url = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('Backend de pagamentos não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  return url
}

async function getAccessToken() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Não foi possível validar sua sessão.')
  const token = data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para continuar o pagamento.')
  return token
}

export async function createStripeCheckoutSession(plan: SignupPlan) {
  const token = await getAccessToken()
  const response = await fetch(`${getAdminApiUrl()}/api/stripe/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  })

  const payload = await response.json().catch(() => ({} as { error?: string; url?: string }))
  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível iniciar o checkout agora.')
  }
  if (!payload.url) {
    throw new Error('Checkout indisponível no momento.')
  }
  return payload.url as string
}

export async function redirectToStripeCheckout(plan: SignupPlan) {
  const url = await createStripeCheckoutSession(plan)
  window.location.href = url
}
