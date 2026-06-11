import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createReportShareToken, getOwnerReportById, parseReportStatus, updateOwnerReport } from '@/app/lib/reports'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const report = await getOwnerReportById(ownerId, id)
    if (!report) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ report }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }

    console.error('[reports/get] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar o documento agora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
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
      return NextResponse.json({ error: 'Nenhuma alteracao válida enviada.' }, { status: 400, headers: corsHeaders })
    }

    const existing = patchBody !== undefined ? await getOwnerReportById(ownerId, id) : null
    const shouldResubmitCoordinatorReview =
      existing?.report_type === 'development_report'
      && existing.coordinator_review_status === 'changes_requested'

    const updated = await updateOwnerReport({
      ownerId,
      reportId: id,
      body: patchBody,
      status: nextStatus,
      isFinalVersion,
      coordinatorReviewStatus: shouldResubmitCoordinatorReview ? 'pending' : undefined,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ report: updated }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }

    console.error('[reports/update] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível salvar o documento agora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = typeof body.action === 'string' ? body.action : ''

    if (action !== 'create-share-link') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400, headers: corsHeaders })
    }

    const report = await getOwnerReportById(ownerId, id)
    if (!report) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404, headers: corsHeaders })
    }

    const token = createReportShareToken(id)
    const origin = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '') || new URL(request.url).origin
    const shareUrl = `${origin}/public/reports/${id}?token=${encodeURIComponent(token)}`

    return NextResponse.json({ shareUrl }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }

    console.error('[reports/share] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível criar o link de compartilhamento agora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}
