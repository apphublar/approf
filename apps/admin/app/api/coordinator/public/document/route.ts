import { NextResponse } from 'next/server'
import {
  getCoordinatorDocumentInviteInfo,
  getCoordinatorDocumentWorkspace,
  verifyCoordinatorDocumentAccess,
} from '@/app/lib/coordinator-review'

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() || ''
    const accessToken = request.headers.get('x-coordinator-access')?.trim() || ''
    if (!token) {
      return NextResponse.json({ error: 'Informe o token de acesso.' }, { status: 400 })
    }

    if (accessToken) {
      const workspace = await getCoordinatorDocumentWorkspace(token, accessToken)
      return NextResponse.json(workspace)
    }

    const invite = await getCoordinatorDocumentInviteInfo(token)
    if (!invite) return NextResponse.json({ error: 'Link de acesso não encontrado.' }, { status: 404 })

    return NextResponse.json({
      share: {
        coordinatorName: invite.share.coordinator_name,
        coordinatorEmail: invite.share.coordinator_email,
        accessStatus: invite.share.access_status,
        teacher: invite.teacher,
        reportType: invite.report.report_type,
      },
    })
  } catch (error) {
    console.error('[coordinator/public/document] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível carregar o documento.' },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string'
      ? body.password.trim()
      : typeof body.code === 'string'
        ? body.code.trim()
        : ''
    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Informe e-mail e senha de acesso.' }, { status: 400 })
    }
    const accessToken = await verifyCoordinatorDocumentAccess({ token, email, password })
    return NextResponse.json({ accessToken })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível validar o acesso.' },
      { status: 400 },
    )
  }
}
