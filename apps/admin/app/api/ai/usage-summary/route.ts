import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const MONTHLY_GIZTOKENS_DEFAULT = 1000
const INCLUDED_COST_LIMIT_CENTS = 10000

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const supabase = createSupabaseServiceClient()
    const { start, end } = getMonthPeriod(new Date())

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
      .select('entitlement_type,cycle_label,included_quantity,used_quantity')
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

    const giztokensIncluded = wallet?.giztokens_included ?? MONTHLY_GIZTOKENS_DEFAULT
    const giztokensUsed = wallet?.giztokens_used ?? 0
    const costLimit = wallet?.included_cost_limit_cents ?? INCLUDED_COST_LIMIT_CENTS
    const costUsed = wallet?.included_cost_used_cents ?? 0

    return NextResponse.json(
      {
        wallet: {
          giztokensIncluded,
          giztokensUsed,
          giztokensRemaining: Math.max(0, giztokensIncluded - giztokensUsed),
          includedCostLimitCents: costLimit,
          includedCostUsedCents: costUsed,
          includedCostRemainingCents: Math.max(0, costLimit - costUsed),
          periodStart: wallet?.period_start ?? start,
          periodEnd: wallet?.period_end ?? end,
        },
        entitlements: (entitlements ?? []).map((item) => ({
          entitlementType: item.entitlement_type,
          cycleLabel: item.cycle_label,
          includedQuantity: item.included_quantity ?? 0,
          usedQuantity: item.used_quantity ?? 0,
          remainingQuantity: Math.max(0, (item.included_quantity ?? 0) - (item.used_quantity ?? 0)),
        })),
        generatedThisMonth: count ?? 0,
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
