import { NextResponse } from 'next/server'
import { getAdminSessionFromCookies } from '@/app/lib/admin-auth'
import { listContinuityRequestsForAdmin, updateContinuityRequestStatus, type ContinuityRequestStatus } from '@/app/lib/continuity'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

async function requireAdmin() {
  const session = await getAdminSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401, headers: CORS_HEADERS })
  }
  return session
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    const requests = await listContinuityRequestsForAdmin()
    return NextResponse.json({ requests }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error('[continuity/requests/admin/list] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar solicitações de continuidade.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const requestId = typeof body.requestId === 'string' ? body.requestId : ''
    const status = typeof body.status === 'string' ? body.status as ContinuityRequestStatus : null
    const reviewNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes : null
    const targetClassId = typeof body.targetClassId === 'string' ? body.targetClassId : null

    if (!requestId || !status || !['approved', 'rejected', 'canceled'].includes(status)) {
      return NextResponse.json({ error: 'Dados de revisão inválidos.' }, { status: 400, headers: CORS_HEADERS })
    }

    await updateContinuityRequestStatus({
      requestId,
      status,
      reviewerId: auth.userId,
      reviewNotes,
      targetClassId,
    })

    const requests = await listContinuityRequestsForAdmin()
    return NextResponse.json({ requests }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error('[continuity/requests/admin/update] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível atualizar a solicitação.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
