import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { searchChildPreviews } from '@/app/lib/continuity'

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
    const requesterId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const childCode = typeof body.childCode === 'string' ? body.childCode : ''
    const name = typeof body.name === 'string' ? body.name : ''
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate : ''

    const previews = await searchChildPreviews({
      requesterId,
      childCode: childCode || undefined,
      name: name || undefined,
      birthDate: birthDate || undefined,
    })

    return NextResponse.json({ previews }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[continuity/search] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível buscar a criança agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
