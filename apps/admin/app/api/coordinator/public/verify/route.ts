import { NextResponse } from 'next/server'
import { getCoordinatorInviteInfo, verifyCoordinatorAccess } from '@/app/lib/coordinator-review'

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() || ''
    const invite = token ? await getCoordinatorInviteInfo(token) : null
    if (!invite) return NextResponse.json({ error: 'Link de acesso não encontrado.' }, { status: 404 })
    const { share, teacher, studentCount } = invite
    return NextResponse.json({
      share: {
        coordinatorName: share.coordinator_name,
        coordinatorEmail: share.coordinator_email,
        accessStatus: share.access_status,
        teacher,
        studentCount,
      },
    })
  } catch (error) {
    console.error('[coordinator/public/info] erro interno', error)
    return NextResponse.json({ error: 'Não foi possível carregar o convite.' }, { status: 500 })
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
    const accessToken = await verifyCoordinatorAccess({ token, email, password })
    return NextResponse.json({ accessToken })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível validar o acesso.' }, { status: 400 })
  }
}
