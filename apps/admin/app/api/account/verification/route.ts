import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createTeacherVerificationRequest, getTeacherAccountData } from '@/app/lib/account'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

type VerificationDocInput = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const documents = Array.isArray(body.documents) ? (body.documents as VerificationDocInput[]) : []
    const schoolIds = Array.isArray(body.schoolIds)
      ? body.schoolIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    const notes = typeof body.notes === 'string' ? body.notes : undefined

    const verification = await createTeacherVerificationRequest(ownerId, {
      schoolIds,
      notes,
      documents,
    })
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json({ verification, account }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível enviar a verificação agora.' },
      { status: 400, headers: CORS_HEADERS },
    )
  }
}
