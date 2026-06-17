import { NextResponse } from 'next/server'
import { accessStatusFromSubscription, formatPlanLabel } from '@/app/lib/admin-utils'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

const STATUS_LABELS: Record<string, string> = {
  active: 'Pagando',
  trial: 'Trial',
  overdue: 'Em atraso',
  blocked: 'Bloqueada',
  free: 'Gratis',
  canceled: 'Cancelada',
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscriptions(status, plan, current_period_end)')
    .eq('role', 'teacher')
    .or(`full_name.ilike.%${escapeIlike(q)}%,email.ilike.%${escapeIlike(q)}%`)
    .order('full_name', { ascending: true })
    .limit(8)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = (data ?? []).map((teacher) => {
    const subscription = teacher.subscriptions?.[0] ?? null
    const status = accessStatusFromSubscription(subscription)
    return {
      id: teacher.id,
      name: teacher.full_name || 'Professora',
      email: teacher.email,
      status,
      statusLabel: STATUS_LABELS[status] ?? formatPlanLabel(subscription?.plan),
    }
  })

  return NextResponse.json({ results })
}

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, '')
}
