export function teacherInitials(name: string) {
  const parts = name.replace(/^Prof\.?\s*/i, '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function formatNumberPt(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value))
}

export function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function formatCompactNumber(value: number) {
  if (value >= 1000) {
    const compact = value / 1000
    return `${compact.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return formatNumberPt(value)
}

export function formatRelativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `ha ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `ha ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `ha ${days} dia${days === 1 ? '' : 's'}`
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

export function formatPlanLabel(plan?: string | null) {
  if (!plan) return 'Sem plano'
  const labels: Record<string, string> = {
    free: 'Gratis',
    trial_7_days: 'Trial 7 dias',
    trial_15_days: 'Trial 15 dias',
    monthly: 'Mensal',
    mensal: 'Mensal',
    semiannual: 'Semestral',
    semestral: 'Semestral',
    annual: 'Anual',
    anual: 'Anual',
    verification_required: 'Em analise',
  }
  return labels[plan] ?? plan
}

export function gizPlanLimit(plan?: string | null) {
  const normalized = (plan ?? '').toLowerCase()
  if (normalized.includes('semiannual') || normalized.includes('semestral')) return 9000
  if (normalized.includes('annual') || normalized.includes('anual')) return 10000
  return 8000
}

export function accessStatusFromSubscription(subscription?: {
  status: string
  plan: string
  current_period_end: string | null
} | null) {
  if (!subscription) return 'free'
  if (subscription.status === 'blocked') return 'blocked'
  if (subscription.status === 'canceled') return 'canceled'
  if (subscription.status === 'overdue') return 'overdue'
  if (subscription.status === 'trial') return 'trial'
  if (['monthly', 'mensal', 'semiannual', 'semestral', 'annual', 'anual'].includes(subscription.plan)) {
    if (subscription.current_period_end && new Date(subscription.current_period_end).getTime() < Date.now()) {
      return 'overdue'
    }
    return subscription.status === 'active' ? 'active' : subscription.status
  }
  if (subscription.plan === 'free') return 'free'
  return subscription.status
}

export function verificationStatusLabel(status?: string | null) {
  if (status === 'approved') return 'Verificada'
  if (status === 'rejected') return 'Rejeitada'
  return 'Pendente'
}

export function safeReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}
