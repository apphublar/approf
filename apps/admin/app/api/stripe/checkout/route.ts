import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, getAuthenticatedUserId, createSupabaseServiceClient } from '@/app/lib/supabase-server'
import { createStripeCheckoutSession } from '@/app/lib/stripe-subscriptions'
import { normalizeBillingPlanId } from '@/app/lib/subscription-plans'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const planId = normalizeBillingPlanId(typeof body.plan === 'string' ? body.plan : null)
    if (!planId) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400, headers: corsHeaders })
    }

    const supabase = createSupabaseServiceClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', ownerId)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile?.email) {
      return NextResponse.json({ error: 'E-mail da conta não encontrado.' }, { status: 400, headers: corsHeaders })
    }

    const session = await createStripeCheckoutSession({
      ownerId,
      email: profile.email,
      planId,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Não foi possível iniciar o checkout.' }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json({ url: session.url, sessionId: session.id }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[stripe/checkout] erro interno', error)
    const message = error instanceof Error ? error.message : 'Não foi possível iniciar o checkout agora.'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
