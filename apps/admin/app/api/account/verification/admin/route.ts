import { NextResponse } from 'next/server'
import { listTeacherVerificationRequests, updateTeacherVerificationStatus } from '@/app/lib/account'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  try {
    const requests = await listTeacherVerificationRequests()
    return NextResponse.json({ requests }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error('[account/verification/admin/list] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar solicitações de verificação.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const verificationId = typeof body.verificationId === 'string' ? body.verificationId : ''
    const status = typeof body.status === 'string' ? body.status : ''
    const reviewNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes : undefined

    if (!verificationId || !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Dados de atualização inválidos.' }, { status: 400, headers: CORS_HEADERS })
    }

    await updateTeacherVerificationStatus({
      verificationId,
      status: status as 'pending' | 'approved' | 'rejected',
      reviewNotes,
    })
    const requests = await listTeacherVerificationRequests()
    return NextResponse.json({ requests }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error('[account/verification/admin/update] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível atualizar a solicitação agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
