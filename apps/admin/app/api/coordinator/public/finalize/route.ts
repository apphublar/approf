import { NextResponse } from 'next/server'
import { finalizeCoordinatorReview } from '@/app/lib/coordinator-review'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const accessToken = request.headers.get('x-coordinator-access')?.trim() || ''
    if (!token || !accessToken) {
      return NextResponse.json({ error: 'Acesso não validado.' }, { status: 401 })
    }
    const summary = await finalizeCoordinatorReview(token, accessToken)
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível finalizar a revisão.' },
      { status: 400 },
    )
  }
}
