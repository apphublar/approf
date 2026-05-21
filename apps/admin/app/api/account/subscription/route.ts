import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { cancelTeacherSubscription, getTeacherAccountData } from '@/app/lib/account'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = typeof body.action === 'string' ? body.action : ''
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Acao invalida.' }, { status: 400, headers: CORS_HEADERS })
    }

    await cancelTeacherSubscription(ownerId)
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[account/subscription/cancel] erro interno', error)
    return NextResponse.json({ error: 'Nao foi possivel cancelar a assinatura agora.' }, { status: 500, headers: CORS_HEADERS })
  }
}
