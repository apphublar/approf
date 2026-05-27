import { NextResponse } from 'next/server'
import { updateCoordinatorReport } from '@/app/lib/coordinator-review'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const accessToken = request.headers.get('x-coordinator-access')?.trim() || ''
    const action = typeof body.action === 'string' ? body.action : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined
    const reportBody = typeof body.body === 'string' ? body.body : undefined
    if (!token || !accessToken || !['comment', 'request_changes', 'approve'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }
    const report = await updateCoordinatorReport({
      token,
      accessToken,
      reportId: id,
      action: action as 'comment' | 'request_changes' | 'approve',
      notes,
      body: reportBody,
    })
    return NextResponse.json({ report })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o relatório.' }, { status: 400 })
  }
}
