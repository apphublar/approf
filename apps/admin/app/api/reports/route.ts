import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createOwnerReport, listOwnerReports, parseReportStatus } from '@/app/lib/reports'

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
    const compact = searchParams.get('compact') === '1'

    const reports = await listOwnerReports(ownerId, {
      status,
      reportType,
      studentId,
      classId,
      limit,
      compact,
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

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const reportType = typeof body.reportType === 'string' ? body.reportType.trim() : ''
    const content = typeof body.body === 'string' ? body.body : ''
    const promptVersion = typeof body.promptVersion === 'string' ? body.promptVersion : null
    const studentId = typeof body.studentId === 'string' ? body.studentId : null
    const classId = typeof body.classId === 'string' ? body.classId : null

    if (!reportType) {
      return NextResponse.json({ error: 'Tipo de documento obrigatorio.' }, { status: 400, headers: CORS_HEADERS })
    }

    if (content.trim().length < 10) {
      return NextResponse.json({ error: 'Conteudo do documento muito curto.' }, { status: 400, headers: CORS_HEADERS })
    }

    const report = await createOwnerReport({
      ownerId,
      reportType,
      body: content,
      promptVersion,
      studentId,
      classId,
      status: 'ready',
    })

    return NextResponse.json({ report }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }

    console.error('[reports/create] erro interno', error)
    return NextResponse.json(
      { error: 'Nao foi possivel criar o documento agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
