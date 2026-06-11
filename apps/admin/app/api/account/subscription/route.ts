import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { cancelTeacherSubscription, getTeacherAccountData } from '@/app/lib/account'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = typeof body.action === 'string' ? body.action : ''
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400, headers: corsHeaders })
    }

    await cancelTeacherSubscription(ownerId)
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[account/subscription/cancel] erro interno', error)
    return NextResponse.json({ error: 'Não foi possível cancelar a assinatura agora.' }, { status: 500, headers: corsHeaders })
  }
}
