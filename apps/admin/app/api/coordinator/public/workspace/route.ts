import { NextResponse } from 'next/server'
import { getCoordinatorWorkspace } from '@/app/lib/coordinator-review'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')?.trim() || ''
    const accessToken = request.headers.get('x-coordinator-access')?.trim() || ''
    if (!token || !accessToken) return NextResponse.json({ error: 'Acesso não validado.' }, { status: 401 })
    const workspace = await getCoordinatorWorkspace(token, accessToken)
    return NextResponse.json(workspace)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar a turma.' }, { status: 401 })
  }
}
