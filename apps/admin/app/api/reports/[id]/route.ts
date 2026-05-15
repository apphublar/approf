import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { getOwnerReportById, parseReportStatus, updateOwnerReport } from '@/app/lib/reports'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const report = await getOwnerReportById(ownerId, id)
    if (!report) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404, headers: CORS_HEADERS })
    }

    return NextResponse.json({ report }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }

    console.error('[reports/get] erro interno', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar o documento agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const { id } = await params

    const status = parseReportStatus(body.status)
    const archive = body.archive === true
    const nextStatus = archive ? 'archived' : status
    const patchBody = typeof body.body === 'string' ? body.body : undefined
    const isFinalVersion = typeof body.isFinalVersion === 'boolean' ? body.isFinalVersion : undefined

    if (!nextStatus && patchBody === undefined && isFinalVersion === undefined) {
      return NextResponse.json({ error: 'Nenhuma alteracao valida enviada.' }, { status: 400, headers: CORS_HEADERS })
    }

    const updated = await updateOwnerReport({
      ownerId,
      reportId: id,
      body: patchBody,
      status: nextStatus,
      isFinalVersion,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Documento nao encontrado.' }, { status: 404, headers: CORS_HEADERS })
    }

    return NextResponse.json({ report: updated }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }

    console.error('[reports/update] erro interno', error)
    return NextResponse.json(
      { error: 'Nao foi possivel salvar o documento agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
