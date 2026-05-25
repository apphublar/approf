import { Bot } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type AiLog = {
  owner_id: string
  generation_type: string
  status: string
  input_tokens: number
  output_tokens: number
  actual_cost_cents: number
  estimated_cost_cents: number
  created_at: string
}

type Profile = {
  id: string
  full_name: string
  email: string
}

export default async function AiUsagePage() {
  const supabase = createSupabaseServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: logsData, error } = await supabase
    .from('ai_generation_logs')
    .select('owner_id, generation_type, status, input_tokens, output_tokens, actual_cost_cents, estimated_cost_cents, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new Error(error.message)

  const logs = (logsData ?? []) as AiLog[]
  const ownerIds = Array.from(new Set(logs.map((item) => item.owner_id).filter(Boolean)))
  const profilesResult = ownerIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds)
    : { data: [], error: null }
  if (profilesResult.error) throw new Error(profilesResult.error.message)

  const profiles = new Map(((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]))
  const rows = Array.from(groupByOwner(logs).entries())
    .map(([ownerId, ownerLogs]) => {
      const profile = profiles.get(ownerId)
      const totalTokens = ownerLogs.reduce((sum, item) => sum + Number(item.input_tokens ?? 0) + Number(item.output_tokens ?? 0), 0)
      const totalCost = ownerLogs.reduce((sum, item) => sum + Number(item.actual_cost_cents || item.estimated_cost_cents || 0), 0)
      const failedCount = ownerLogs.filter((item) => item.status === 'failed' || item.status === 'refunded').length
      return {
        ownerId,
        name: profile?.full_name ?? 'Professora',
        email: profile?.email ?? ownerId,
        total: ownerLogs.length,
        totalTokens,
        totalCost,
        failedCount,
        status: failedCount >= 3 ? 'review_required' : 'active',
      }
    })
    .sort((a, b) => b.totalCost - a.totalCost)

  return (
    <>
      <PageHeader
        eyebrow="Uso de IA"
        title="Relatorios e custos reais"
        description="Uso dos ultimos 30 dias calculado a partir de ai_generation_logs. Status de revisão aparece apenas quando ha falhas/estornos recorrentes."
        action={
          <span className="status-pill">
            <Bot size={16} />
            {logs.length} geracoes
          </span>
        }
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head ai-grid">
            <span>Professora</span>
            <span>Geracoes</span>
            <span>Tokens</span>
            <span>Custo</span>
            <span>Status</span>
          </div>
          {rows.map((usage) => (
            <div className="table-row ai-grid" key={usage.ownerId}>
              <span>
                <strong>{usage.name}</strong>
                <small>{usage.email}</small>
              </span>
              <span>{usage.total}</span>
              <span>{formatTokens(usage.totalTokens)}</span>
              <span>{formatCurrency(usage.totalCost)}</span>
              <span>
                <StatusBadge status={usage.status} />
                {usage.failedCount > 0 && <small>{usage.failedCount} falhas/estornos</small>}
              </span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="table-row ai-grid">
              <strong>Nenhum uso de IA nos ultimos 30 dias</strong>
              <span>0</span>
              <span>0</span>
              <span>R$ 0,00</span>
              <StatusBadge status="active" />
            </div>
          )}
        </div>
      </article>
    </>
  )
}

function groupByOwner(logs: AiLog[]) {
  const grouped = new Map<string, AiLog[]>()
  for (const log of logs) {
    const list = grouped.get(log.owner_id) ?? []
    list.push(log)
    grouped.set(log.owner_id, list)
  }
  return grouped
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) return `${Math.round(tokens / 100) / 10}k`
  return String(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
