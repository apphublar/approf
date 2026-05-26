import Link from 'next/link'
import { AlertTriangle, Bot, CheckCircle2, FileText, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from './components/PageHeader'
import { StatusBadge } from './components/StatusBadge'
import { createSupabaseServiceClient } from './lib/supabase-server'

export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  full_name: string
  email: string
  subscriptions?: Array<{ status: string; plan: string }>
  classes?: Array<{ id: string }>
  ai_generation_logs?: Array<{ id: string }>
}

type Material = {
  id: string
  title: string
  status: string
  detected_category: string | null
}

export default async function AdminHome() {
  const supabase = createSupabaseServiceClient()
  const [profilesResult, subscriptionsResult, materialsResult, aiResult, reportsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, subscriptions(status, plan), classes(id), ai_generation_logs(id)')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('subscriptions').select('id, status, plan'),
    supabase.from('materials').select('id, title, status, detected_category').order('created_at', { ascending: false }).limit(5),
    supabase.from('ai_generation_logs').select('id, actual_cost_cents, estimated_cost_cents').limit(2000),
    supabase.from('material_reports').select('id').eq('status', 'open'),
  ])

  if (profilesResult.error) throw new Error(profilesResult.error.message)
  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message)
  if (materialsResult.error) throw new Error(materialsResult.error.message)
  if (aiResult.error) throw new Error(aiResult.error.message)
  if (reportsResult.error) throw new Error(reportsResult.error.message)

  const teachers = (profilesResult.data ?? []) as Profile[]
  const subscriptions = subscriptionsResult.data ?? []
  const materials = (materialsResult.data ?? []) as Material[]
  const aiLogs = aiResult.data ?? []
  const aiCost = aiLogs.reduce((sum, item) => sum + Number(item.actual_cost_cents || item.estimated_cost_cents || 0), 0)

  const metrics = [
    { label: 'Professoras', value: String(subscriptions.length ? new Set(subscriptions.map((_, index) => index)).size : teachers.length), detail: `${teachers.length} recentes`, icon: Users },
    { label: 'Trials ativos', value: String(subscriptions.filter((item) => item.status === 'trial').length), detail: 'acesso temporario', icon: CheckCircle2 },
    { label: 'Assinaturas ativas', value: String(subscriptions.filter((item) => item.status === 'active').length), detail: 'mensal/anual', icon: ShieldCheck },
    { label: 'Custo IA', value: formatCurrency(aiCost), detail: `${aiLogs.length} geracoes`, icon: Bot },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Controle operacional do Approf"
        description="Painel em produção com dados reais de professoras, assinaturas, materiais, IA e privacidade."
        action={
          <span className="status-pill">
            <ShieldCheck size={16} />
            Produção
          </span>
        }
      />

      <section className="metrics-grid" aria-label="Metricas principais">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <article className="metric-card" key={metric.label}>
              <Icon size={20} />
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </article>
          )
        })}
      </section>

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Acesso</p>
              <h2>Professoras recentes</h2>
            </div>
            <Link className="quiet-button" href="/professoras">Ver todas</Link>
          </div>

          <div className="table">
            <div className="table-row table-head teachers-grid">
              <span>Professora</span>
              <span>Status</span>
              <span>Turmas</span>
              <span>IA</span>
            </div>
            {teachers.map((teacher) => {
              const subscription = teacher.subscriptions?.[0]
              return (
                <div className="table-row teachers-grid" key={teacher.id}>
                  <span>
                    <strong>{teacher.full_name}</strong>
                    <small>{teacher.email}</small>
                  </span>
                  <StatusBadge status={subscription?.status ?? 'active'} />
                  <span>{teacher.classes?.length ?? 0} turmas</span>
                  <span>{teacher.ai_generation_logs?.length ?? 0} geracoes</span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Materiais</p>
              <h2>Biblioteca</h2>
            </div>
            <FileText size={20} />
          </div>
          <div className="stack-list">
            {materials.map((material) => (
              <div className="stack-item" key={material.id}>
                <span>
                  <strong>{material.title}</strong>
                  <small>{material.detected_category || 'Sem categoria'}</small>
                </span>
                <StatusBadge status={material.status} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel privacy-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dados sensiveis</p>
              <h2>Operação</h2>
            </div>
            <Bot size={20} />
          </div>

          <ul className="privacy-list">
            <li><CheckCircle2 size={16} />Buckets sensiveis privados.</li>
            <li><CheckCircle2 size={16} />Triagem automatica de cadastro ativa.</li>
            <li><CheckCircle2 size={16} />Materiais passam por IA e moderacao.</li>
            <li><CheckCircle2 size={16} />Planos e links de pagamento no admin.</li>
          </ul>
        </article>

        <article className="panel alert-panel">
          <AlertTriangle size={22} />
          <div>
            <p className="eyebrow">Fila</p>
            <h2>{reportsResult.data?.length ?? 0} denuncia(s) aberta(s)</h2>
            <p>Revise materiais denunciados em Material de Apoio antes de republicar ou bloquear definitivamente.</p>
          </div>
        </article>
      </section>
    </>
  )
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
