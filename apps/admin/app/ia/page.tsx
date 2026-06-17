import { PageHeader } from '../components/PageHeader'
import { formatCurrencyFromCents, formatNumberPt, teacherInitials } from '../lib/admin-utils'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export const dynamic = 'force-dynamic'

type AiLog = {
  owner_id: string
  status: string
  input_tokens: number
  output_tokens: number
  actual_cost_cents: number
  estimated_cost_cents: number
}

export default async function AiUsagePage() {
  const supabase = createSupabaseServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: logsData, error } = await supabase
    .from('ai_generation_logs')
    .select('owner_id, status, input_tokens, output_tokens, actual_cost_cents, estimated_cost_cents, created_at')
    .gte('created_at', since.toISOString())
    .limit(1000)
  if (error) throw new Error(error.message)

  const logs = (logsData ?? []) as AiLog[]
  const ownerIds = Array.from(new Set(logs.map((item) => item.owner_id).filter(Boolean)))
  const profilesResult = ownerIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds)
    : { data: [], error: null }
  if (profilesResult.error) throw new Error(profilesResult.error.message)

  const profiles = new Map(((profilesResult.data ?? []) as Array<{ id: string; full_name: string }>).map((profile) => [profile.id, profile]))
  const rows = Array.from(groupByOwner(logs).entries())
    .map(([ownerId, ownerLogs]) => {
      const profile = profiles.get(ownerId)
      const totalTokens = ownerLogs.reduce((sum, item) => sum + Number(item.input_tokens ?? 0) + Number(item.output_tokens ?? 0), 0)
      const totalCost = ownerLogs.reduce((sum, item) => sum + Number(item.actual_cost_cents || item.estimated_cost_cents || 0), 0)
      const failedCount = ownerLogs.filter((item) => item.status === 'failed' || item.status === 'refunded').length
      return {
        ownerId,
        name: profile?.full_name ?? 'Professora',
        total: ownerLogs.length,
        totalTokens,
        totalCost,
        failedCount,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Sistema"
        title="Uso de IA"
        badge={<span className="readonly-badge">somente leitura</span>}
        description="Custo e volume dos ultimos 30 dias. Para ajustar GizTokens, va em Professoras."
      />

      <article className="panel-v2">
        <div className="data-table-v2-head" style={{ gridTemplateColumns: '2.4fr 1fr 1.2fr 1fr 1fr' }}>
          <span>Professora</span><span>Geracoes</span><span>Tokens</span><span>Custo</span><span>Falhas</span>
        </div>
        {rows.map((row) => (
          <div key={row.ownerId} className="data-table-v2-row" style={{ gridTemplateColumns: '2.4fr 1fr 1.2fr 1fr 1fr' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="teacher-avatar">{teacherInitials(row.name)}</span>
              <strong>{row.name}</strong>
            </span>
            <span>{row.total}</span>
            <span style={{ color: '#5f6b63' }}>{formatNumberPt(row.totalTokens)}</span>
            <span>{formatCurrencyFromCents(row.totalCost)}</span>
            <span>
              {row.failedCount > 0 ? (
                <span className="status-chip status-chip-blocked">{row.failedCount} falhas</span>
              ) : (
                <span style={{ color: '#c2c7bd' }}>—</span>
              )}
            </span>
          </div>
        ))}
      </article>
    </div>
  )
}

function groupByOwner(logs: AiLog[]) {
  const map = new Map<string, AiLog[]>()
  for (const log of logs) {
    const list = map.get(log.owner_id) ?? []
    list.push(log)
    map.set(log.owner_id, list)
  }
  return map
}
