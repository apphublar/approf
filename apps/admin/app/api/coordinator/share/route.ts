import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createCoordinatorShare } from '@/app/lib/coordinator-review'

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
    const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
    const coordinatorName = typeof body.coordinatorName === 'string' ? body.coordinatorName.trim() : ''
    const coordinatorEmail = typeof body.coordinatorEmail === 'string' ? body.coordinatorEmail.trim() : ''

    if (!classId || !coordinatorName || !coordinatorEmail) {
      return NextResponse.json({ error: 'Informe turma, nome e e-mail da coordenadora.' }, { status: 400, headers: CORS_HEADERS })
    }

    const origin = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '') || new URL(request.url).origin
    const result = await createCoordinatorShare({ ownerId, classId, coordinatorName, coordinatorEmail, origin })
    return NextResponse.json(result, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[coordinator/share] erro interno', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível compartilhar a turma.' }, { status: 500, headers: CORS_HEADERS })
  }
}
