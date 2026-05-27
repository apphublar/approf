import { NextResponse } from 'next/server'
import { getCoordinatorShareByToken, verifyCoordinatorAccess } from '@/app/lib/coordinator-review'

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() || ''
    const share = token ? await getCoordinatorShareByToken(token) : null
    if (!share) return NextResponse.json({ error: 'Link de acesso não encontrado.' }, { status: 404 })
    return NextResponse.json({
      share: {
        coordinatorName: share.coordinator_name,
        coordinatorEmail: share.coordinator_email,
        accessStatus: share.access_status,
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
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!token || !email || !code) {
      return NextResponse.json({ error: 'Informe e-mail e código de acesso.' }, { status: 400 })
    }
    const accessToken = await verifyCoordinatorAccess({ token, email, code })
    return NextResponse.json({ accessToken })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível validar o acesso.' }, { status: 400 })
  }
}
