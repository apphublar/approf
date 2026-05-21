import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { getTeacherAccountData, updateTeacherProfile } from '@/app/lib/account'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[account/get] erro interno', error)
    return NextResponse.json({ error: 'Nao foi possivel carregar sua conta agora.' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function PATCH(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    await updateTeacherProfile(ownerId, {
      fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
      phone: typeof body.phone === 'string' || body.phone === null ? (body.phone as string | null) : undefined,
    })
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[account/update] erro interno', error)
    return NextResponse.json({ error: 'Nao foi possivel atualizar seus dados agora.' }, { status: 500, headers: CORS_HEADERS })
  }
}
