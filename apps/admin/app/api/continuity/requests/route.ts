import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createContinuityRequest, type ContinuityRequestType } from '@/app/lib/continuity'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const REQUEST_TYPES = new Set<ContinuityRequestType>(['link', 'transfer_teacher', 'transfer_class'])

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const requesterId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const requestType = typeof body.requestType === 'string' ? body.requestType as ContinuityRequestType : null
    const studentId = typeof body.studentId === 'string' ? body.studentId : ''
    const targetClassId = typeof body.targetClassId === 'string' ? body.targetClassId : null
    const targetTeacherCode = typeof body.targetTeacherCode === 'string' ? body.targetTeacherCode : null
    const reason = typeof body.reason === 'string' ? body.reason : null

    if (!requestType || !REQUEST_TYPES.has(requestType) || !studentId) {
      return NextResponse.json({ error: 'Dados da solicitação inválidos.' }, { status: 400, headers: CORS_HEADERS })
    }

    const result = await createContinuityRequest({
      requesterId,
      requestType,
      studentId,
      targetClassId,
      targetTeacherCode,
      reason,
    })

    return NextResponse.json(result, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[continuity/requests] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível registrar a solicitação.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
