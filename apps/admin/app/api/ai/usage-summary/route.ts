import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { syncAndLoadOwnerMonthlyWalletSummary } from '@/app/lib/ai-usage'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const supabase = createSupabaseServiceClient()
    const { start, end } = getMonthPeriod(new Date())
    const walletSummary = await syncAndLoadOwnerMonthlyWalletSummary(ownerId)

    const { count, error: countError } = await supabase
      .from('ai_generation_logs')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`)

    if (countError) throw countError

    const { data: monthlyTypeRows, error: monthlyTypesError } = await supabase
      .from('ai_generation_logs')
      .select('generation_type,result_summary')
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`)

    if (monthlyTypesError) throw monthlyTypesError

    const generatedImagesThisMonth = (monthlyTypeRows ?? []).filter((item) =>
      item.generation_type === 'portfolio_image'
      || getImageKindFromSummary(item.result_summary) === 'generated_image'
    ).length
    const generatedDocumentsThisMonth = (monthlyTypeRows ?? []).filter((item) =>
      item.generation_type !== 'portfolio_image'
      && item.generation_type !== 'audio_transcription'
      && getImageKindFromSummary(item.result_summary) !== 'generated_image'
    ).length

    const { data: recentLogs, error: recentLogsError } = await supabase
      .from('ai_generation_logs')
      .select('id,generation_type,status,provider,model,charge_source,giztokens_charged,estimated_cost_cents,actual_cost_cents,result_summary,student_id,class_id,created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(12)

    if (recentLogsError) throw recentLogsError

    return NextResponse.json(
      {
        wallet: walletSummary,
        generatedThisMonth: count ?? 0,
        generatedDocumentsThisMonth,
        generatedImagesThisMonth,
        recentUsage: (recentLogs ?? []).map((item) => ({
          id: item.id,
          generationType: item.generation_type,
          status: item.status,
          provider: item.provider,
          model: item.model,
          chargeSource: item.charge_source,
          studentId: item.student_id,
          classId: item.class_id,
          reportId: getReportIdFromSummary(item.result_summary),
          giztokensCharged: item.giztokens_charged ?? 0,
          estimatedCostCents: item.estimated_cost_cents ?? 0,
          actualCostCents: item.actual_cost_cents ?? 0,
          createdAt: item.created_at,
        })),
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders })
    }

    console.error('[ai/usage-summary] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível consultar o saldo de IA agora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

function getReportIdFromSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const reportId = (value as { reportId?: unknown }).reportId
  return typeof reportId === 'string' ? reportId : null
}

function getImageKindFromSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const imageKind = (value as { imageKind?: unknown }).imageKind
  return typeof imageKind === 'string' ? imageKind : null
}

function getMonthPeriod(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
