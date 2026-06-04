import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId, createSupabaseServiceClient } from '@/app/lib/supabase-server'
import { createCoordinatorShare } from '@/app/lib/coordinator-review'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')?.trim() || ''
    if (!classId) {
      return NextResponse.json({ error: 'Informe o classId.' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createSupabaseServiceClient()
    const { data: shares, error } = await supabase
      .from('coordinator_class_shares')
      .select('id,coordinator_name,coordinator_email,share_token,access_status,verified_at,last_access_at,updated_at')
      .eq('owner_id', ownerId)
      .eq('class_id', classId)
      .neq('access_status', 'revoked')
      .order('updated_at', { ascending: false })

    if (error) throw error

    const { data: reports } = await supabase
      .from('reports')
      .select('id,student_id,coordinator_review_status,coordinator_review_notes,is_final_version')
      .eq('owner_id', ownerId)
      .eq('class_id', classId)
      .eq('report_type', 'development_report')
      .neq('status', 'archived')

    const reportSummary = {
      total: reports?.length ?? 0,
      approved: reports?.filter((r) => r.coordinator_review_status === 'approved').length ?? 0,
      changesRequested: reports?.filter((r) => r.coordinator_review_status === 'changes_requested').length ?? 0,
    }

    return NextResponse.json({ shares: shares ?? [], reportSummary }, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json({ error: 'Não foi possível carregar o status.' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
    const coordinatorName = typeof body.coordinatorName === 'string' ? body.coordinatorName.trim() : ''
    const coordinatorEmail = typeof body.coordinatorEmail === 'string' ? body.coordinatorEmail.trim() : ''

    if (!classId || !coordinatorName || !coordinatorEmail) {
      return NextResponse.json({ error: 'Informe turma, nome e e-mail da coordenadora.' }, { status: 400, headers: CORS_HEADERS })
    }

    const origin = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '') || new URL(request.url).origin
    const result = await createCoordinatorShare({ ownerId, classId, coordinatorName, coordinatorEmail, origin })
    return NextResponse.json(result, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[coordinator/share] erro interno', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível compartilhar a turma.' }, { status: 500, headers: CORS_HEADERS })
  }
}
