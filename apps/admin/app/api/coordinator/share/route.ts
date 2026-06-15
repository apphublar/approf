import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId, createSupabaseServiceClient } from '@/app/lib/supabase-server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { createCoordinatorShare } from '@/app/lib/coordinator-review'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')?.trim() || ''
    if (!classId) {
      return NextResponse.json({ error: 'Informe o classId.' }, { status: 400, headers: corsHeaders })
    }

    const supabase = createSupabaseServiceClient()
    const requestOrigin = new URL(request.url).origin
    const shareOrigin = resolveCoordinatorPublicOrigin(requestOrigin)
    const { data: shares, error } = await supabase
      .from('coordinator_class_shares')
      .select('id,coordinator_name,coordinator_email,share_token,access_status,verified_at,last_access_at,updated_at')
      .eq('owner_id', ownerId)
      .eq('class_id', classId)
      .neq('access_status', 'revoked')
      .order('updated_at', { ascending: false })

    if (error) throw error

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('class_id', classId)
      .is('archived_at', null)

    if (studentsError) throw studentsError

    const studentIds = (students ?? []).map((student) => student.id)
    const reportsQuery = supabase
      .from('reports')
      .select('id,student_id,coordinator_review_status,coordinator_review_notes,is_final_version')
      .eq('owner_id', ownerId)
      .eq('class_id', classId)
      .eq('report_type', 'development_report')
      .neq('status', 'archived')
    const { data: reports } = studentIds.length
      ? await reportsQuery.in('student_id', studentIds)
      : await reportsQuery.is('student_id', null).limit(0)

    const reportSummary = {
      total: reports?.length ?? 0,
      approved: reports?.filter((r) => r.coordinator_review_status === 'approved').length ?? 0,
      changesRequested: reports?.filter((r) => r.coordinator_review_status === 'changes_requested').length ?? 0,
    }

    return NextResponse.json({
      shares: (shares ?? []).map((share) => ({
        ...share,
        share_url: `${shareOrigin}/coordenadora/${share.share_token}`,
        access_code_expires_at: null,
        has_valid_access_code: true,
      })),
      reportSummary,
    }, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json({ error: 'Não foi possível carregar o status.' }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
    const coordinatorName = typeof body.coordinatorName === 'string' ? body.coordinatorName.trim() : ''
    const coordinatorEmail = typeof body.coordinatorEmail === 'string' ? body.coordinatorEmail.trim() : ''

    if (!classId || !coordinatorName || !coordinatorEmail) {
      return NextResponse.json({ error: 'Informe turma, nome e e-mail da coordenadora.' }, { status: 400, headers: corsHeaders })
    }

    const origin = resolveCoordinatorPublicOrigin(new URL(request.url).origin)
    const result = await createCoordinatorShare({ ownerId, classId, coordinatorName, coordinatorEmail, origin })
    return NextResponse.json(result, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[coordinator/share] erro interno', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível compartilhar a turma.' }, { status: 500, headers: corsHeaders })
  }
}

function resolveCoordinatorPublicOrigin(requestOrigin: string) {
  const customCoordinatorUrl = process.env.NEXT_PUBLIC_COORDINATOR_PUBLIC_URL?.trim().replace(/\/$/, '')
    || process.env.COORDINATOR_PUBLIC_URL?.trim().replace(/\/$/, '')
  if (customCoordinatorUrl && !isLocalhostOrigin(customCoordinatorUrl) && !isAdminOrigin(customCoordinatorUrl)) {
    return customCoordinatorUrl
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (siteUrl && !isLocalhostOrigin(siteUrl)) return siteUrl

  const productionDomain = 'https://approf.com.br'

  const cleanRequestOrigin = requestOrigin.replace(/\/$/, '')
  if (cleanRequestOrigin && !isLocalhostOrigin(cleanRequestOrigin) && !isAdminOrigin(cleanRequestOrigin)) return cleanRequestOrigin

  return productionDomain
}

function isLocalhostOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
  } catch {
    return false
  }
}

function isAdminOrigin(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return [
      'admin.approf.com.br',
      'approf-admin.vercel.app',
    ].includes(url.hostname)
  } catch {
    return false
  }
}
