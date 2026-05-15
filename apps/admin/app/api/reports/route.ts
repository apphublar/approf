import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { listOwnerReports, parseReportStatus } from '@/app/lib/reports'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { searchParams } = new URL(request.url)

    const status = parseReportStatus(searchParams.get('status'))
    const reportType = searchParams.get('reportType')?.trim() || undefined
    const studentId = searchParams.get('studentId')?.trim() || undefined
    const classId = searchParams.get('classId')?.trim() || undefined
    const limitRaw = Number(searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined

    const reports = await listOwnerReports(ownerId, {
      status,
      reportType,
      studentId,
      classId,
      limit,
    })

    return NextResponse.json({ reports }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }

    console.error('[reports/list] erro interno', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar seus documentos agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
