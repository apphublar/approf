import { createSupabaseServiceClient } from './supabase-server'

const GIZTOKENS_OVERAGE_CENTS = 200

export type TeacherWalletSnapshot = {
  giztokensIncluded: number
  giztokensUsed: number
  giztokensRemaining: number
  periodStart: string
  periodEnd: string
}

export function getCurrentMonthPeriod(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}

export async function loadTeacherWalletsForMonth(ownerIds: string[], monthStart: string) {
  if (ownerIds.length === 0) return new Map<string, TeacherWalletSnapshot>()

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('ai_usage_wallets')
    .select('owner_id,giztokens_included,giztokens_used,period_start,period_end')
    .eq('period_type', 'monthly')
    .eq('period_start', monthStart)
    .in('owner_id', ownerIds)

  if (error) throw new Error(error.message)

  const wallets = new Map<string, TeacherWalletSnapshot>()
  for (const row of data ?? []) {
    const included = row.giztokens_included ?? 0
    const used = row.giztokens_used ?? 0
    wallets.set(row.owner_id, {
      giztokensIncluded: included,
      giztokensUsed: used,
      giztokensRemaining: included - used,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    })
  }

  return wallets
}

export async function adjustTeacherGiztokens(input: {
  ownerId: string
  mode: 'add' | 'set_minimum'
  amount: number
  reason: string
}) {
  const amount = Math.round(input.amount)
  if (!input.ownerId) throw new Error('Selecione uma professora.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.')
  if (amount > 100_000) throw new Error('Valor máximo por ajuste: 100.000 GizTokens.')

  const supabase = createSupabaseServiceClient()
  const { start, end } = getCurrentMonthPeriod()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name,email,role')
    .eq('id', input.ownerId)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.role !== 'teacher') throw new Error('Professora não encontrada.')

  const { data: existing, error: selectError } = await supabase
    .from('ai_usage_wallets')
    .select('id,giztokens_included,giztokens_used,included_cost_limit_cents,notes')
    .eq('owner_id', input.ownerId)
    .eq('period_type', 'monthly')
    .eq('period_start', start)
    .eq('period_end', end)
    .maybeSingle()

  if (selectError) throw new Error(selectError.message)

  const currentIncluded = existing?.giztokens_included ?? 0
  const currentUsed = existing?.giztokens_used ?? 0
  const nextIncluded = input.mode === 'add'
    ? currentIncluded + amount
    : Math.max(currentIncluded, amount)

  if (nextIncluded === currentIncluded) {
    throw new Error('O saldo do mês já atende ao valor informado.')
  }

  const nextCostLimit = Math.max(
    existing?.included_cost_limit_cents ?? 0,
    Math.ceil(nextIncluded / 10) + GIZTOKENS_OVERAGE_CENTS,
  )

  const noteLine = `[${new Date().toISOString()}] Ajuste admin (${input.mode === 'add' ? `+${amount}` : `minimo ${amount}`} GizTokens): ${input.reason.trim() || 'sem observacao'}`

  if (existing?.id) {
    const { error } = await supabase
      .from('ai_usage_wallets')
      .update({
        giztokens_included: nextIncluded,
        included_cost_limit_cents: nextCostLimit,
        notes: existing.notes ? `${existing.notes}\n${noteLine}` : noteLine,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('ai_usage_wallets').insert({
      owner_id: input.ownerId,
      period_type: 'monthly',
      period_start: start,
      period_end: end,
      giztokens_included: nextIncluded,
      included_cost_limit_cents: nextCostLimit,
      notes: noteLine,
    })
    if (error) throw new Error(error.message)
  }

  return {
    teacherId: input.ownerId,
    teacherName: profile.full_name,
    teacherEmail: profile.email,
    mode: input.mode,
    amount,
    previousIncluded: currentIncluded,
    nextIncluded,
    giztokensUsed: currentUsed,
    giztokensRemaining: nextIncluded - currentUsed,
    periodStart: start,
    periodEnd: end,
  }
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
