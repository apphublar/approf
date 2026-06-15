import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  getTeacherCoordinatorAccessPasswordStatus,
  saveTeacherCoordinatorAccessPassword,
} from '@/app/lib/coordinator-review'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const status = await getTeacherCoordinatorAccessPasswordStatus(ownerId)
    return NextResponse.json(status, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json({ error: 'Não foi possível carregar a senha da coordenadora.' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function PUT(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const password = typeof body.password === 'string' ? body.password.trim() : ''
    if (!password) {
      return NextResponse.json({ error: 'Informe a senha de acesso.' }, { status: 400, headers: CORS_HEADERS })
    }
    const result = await saveTeacherCoordinatorAccessPassword(ownerId, password)
    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível salvar a senha.' },
      { status: 400, headers: CORS_HEADERS },
    )
  }
}
