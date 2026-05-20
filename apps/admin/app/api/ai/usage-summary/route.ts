import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { getMonthlyWalletPolicy } from '@/app/lib/ai-usage'

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
    const supabase = createSupabaseServiceClient()
    const policy = getMonthlyWalletPolicy()
    const { start, end } = getMonthPeriod(new Date())

    await ensureMonthlyWallet(supabase, ownerId, start, end, policy)

    const { data: wallet, error: walletError } = await supabase
      .from('ai_usage_wallets')
      .select('giztokens_included,giztokens_used,included_cost_limit_cents,included_cost_used_cents,period_start,period_end')
      .eq('owner_id', ownerId)
      .eq('period_type', 'monthly')
      .eq('period_start', start)
      .eq('period_end', end)
      .maybeSingle()

    if (walletError) throw walletError

    const { data: entitlements, error: entitlementsError } = await supabase
      .from('ai_semester_entitlements')
      .select('entitlement_type,cycle_label,student_id,class_id,included_quantity,used_quantity')
      .eq('owner_id', ownerId)
      .order('cycle_start', { ascending: false })
      .limit(12)

    if (entitlementsError) throw entitlementsError

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

    const giztokensIncluded = policy.giztokensIncluded
    const giztokensUsed = Math.max(0, wallet?.giztokens_used ?? 0)
    const costUsed = Math.max(0, wallet?.included_cost_used_cents ?? 0)

    return NextResponse.json(
      {
        wallet: {
          giztokensIncluded,
          giztokensUsed,
          giztokensRemaining: giztokensIncluded - giztokensUsed,
          giztokensOverageLimit: policy.giztokensOverageLimit,
          includedCostLimitCents: policy.costLimitCents,
          includedCostUsedCents: costUsed,
          includedCostRemainingCents: policy.costLimitCents - costUsed,
          includedCostAlertCents: policy.includedCostAlertCents,
          periodStart: wallet?.period_start ?? start,
          periodEnd: wallet?.period_end ?? end,
        },
        entitlements: (entitlements ?? []).map((item) => ({
          entitlementType: item.entitlement_type,
          cycleLabel: item.cycle_label,
          studentId: item.student_id,
          classId: item.class_id,
          includedQuantity: item.included_quantity ?? 0,
          usedQuantity: item.used_quantity ?? 0,
          remainingQuantity: Math.max(0, (item.included_quantity ?? 0) - (item.used_quantity ?? 0)),
        })),
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
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: CORS_HEADERS })
    }

    console.error('[ai/usage-summary] erro interno', error)
    return NextResponse.json(
      { error: 'Nao foi possivel consultar o saldo de IA agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

async function ensureMonthlyWallet(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  ownerId: string,
  periodStart: string,
  periodEnd: string,
  policy: ReturnType<typeof getMonthlyWalletPolicy>,
) {
  const { error } = await supabase
    .from('ai_usage_wallets')
    .upsert(
      {
        owner_id: ownerId,
        period_type: 'monthly',
        period_start: periodStart,
        period_end: periodEnd,
        giztokens_included: policy.giztokensIncluded,
        included_cost_limit_cents: policy.costLimitCents,
      },
      { onConflict: 'owner_id,period_type,period_start,period_end' },
    )

  if (error) throw error
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
