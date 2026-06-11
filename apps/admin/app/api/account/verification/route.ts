import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createTeacherVerificationRequest, getTeacherAccountData } from '@/app/lib/account'

type VerificationDocInput = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
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
    return NextResponse.json({ verification, account }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível enviar a verificação agora.' },
      { status: 400, headers: corsHeaders },
    )
  }
}
