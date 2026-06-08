import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, Coins, Gift, History, ShieldCheck } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getAiUsageSummary, type AiUsageSummary } from '@/services/ai-usage'

export default function GizTokensSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const [summary, setSummary] = useState<AiUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getAiUsageSummary()
      .then((data) => {
        if (active) {
          setSummary(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar seus GizTokens.')
      })

    return () => {
      active = false
    }
  }, [])

  const wallet = summary?.wallet
  const remaining = wallet?.giztokensRemaining ?? 8000
  const included = wallet?.giztokensIncluded ?? 8000
  const overageLimit = wallet?.giztokensOverageLimit ?? 2000
  const used = wallet?.giztokensUsed ?? 0
  const hardLimit = included + overageLimit
  const percent = Math.min(100, Math.max(0, (used / Math.max(1, hardLimit)) * 100))
  const isAlert = remaining <= 0
  const isNegative = remaining < 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">GizTokens</span>
      </div>

      <div className="scroll-area px-[18px] py-5">
        <div className="rounded-app p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] opacity-75 mb-1">Saldo deste mês</p>
              <p className="text-[34px] font-bold leading-none">{formatNumber(remaining)}</p>
              <p className="text-[12px] opacity-80 mt-2">
                {formatNumber(used)} GizTokens usados neste ciclo.
              </p>
            </div>
            <div className="w-12 h-12 rounded-[15px] bg-white/15 flex items-center justify-center">
              <Coins size={24} />
            </div>
          </div>

          <div className="mt-5 h-2 rounded-full bg-white/18 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {(isAlert || isNegative) && (
          <div className="bg-[#FFF3CD] border border-[#F1D58B] rounded-app p-4 mb-4 flex items-start gap-3">
            <AlertTriangle size={18} color="#856404" className="mt-[2px] flex-shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-[#6B5300]">
                {isNegative ? 'Margem de segurança em uso' : 'Alerta de uso mensal'}
              </p>
              <p className="text-[12px] text-[#6B5300] leading-[1.5] mt-1">
                Ao usar o saldo principal, a margem pode chegar até {formatNumber(-overageLimit)} GizTokens.
                Esse extra será considerado no próximo ciclo.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-app p-4 mb-4 text-[12px] text-red-700 leading-[1.5]">
            {error}
          </div>
        )}

        <section className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[12px] bg-gbg text-gm flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-ink">Como funciona</p>
              <p className="text-[11px] text-muted">GizToken acompanha o uso dos recursos automáticos do app.</p>
            </div>
          </div>
          <div className="space-y-2 text-[12px] text-muted leading-[1.6]">
            <p>GizTokens são créditos internos para gerar relatórios, planejamentos e portfólios.</p>
            <p>O saldo principal do ciclo é de {formatNumber(included)} GizTokens.</p>
            <p>Algumas atividades podem entrar como cota inclusa e aparecer com 0 GizToken descontado.</p>
            <p>Existe uma margem técnica de {formatNumber(overageLimit)} GizTokens para evitar bloqueios bruscos.</p>
          </div>
        </section>

        <section className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#FFF3CD] text-[#856404] flex items-center justify-center">
              <Gift size={18} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-ink">Cotas inclusas</p>
              <p className="text-[11px] text-muted">Não descontam GizTokens da professora.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {(summary?.entitlements ?? []).slice(0, 4).map((item) => (
              <div key={`${item.entitlementType}-${item.studentId ?? 'teacher'}-${item.cycleLabel}`} className="rounded-app-sm border border-border px-3 py-2">
                <p className="text-[12px] font-bold text-ink">{formatEntitlement(item.entitlementType, item.studentId, classes)}</p>
                <p className="text-[11px] text-muted mt-1">
                  {item.usedQuantity}/{item.includedQuantity} usados em {item.cycleLabel}
                </p>
              </div>
            ))}

            {(summary?.entitlements ?? []).length === 0 && (
              <p className="text-[12px] text-muted leading-[1.5]">
                As cotas aparecem aqui quando você gera relatórios de desenvolvimento ou portfólios com imagem.
              </p>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-[10px]">
            <History size={15} className="text-muted" />
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Histórico recente</p>
          </div>
          <div className="flex flex-col gap-[9px]">
            {(summary?.recentUsage ?? []).map((item) => (
              <button
                key={item.id}
                onClick={() => item.reportId && openSubscreen('document-detail', { reportId: item.reportId })}
                disabled={!item.reportId}
                className="w-full bg-white rounded-app p-4 border border-border shadow-card text-left disabled:opacity-100 active:scale-[.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-ink">{formatGenerationType(item.generationType)}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {formatDateTime(item.createdAt)} - {findStudentName(item.studentId, classes) ?? formatChargeSource(item.chargeSource)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-ink">{formatNumber(item.giztokensCharged)} Giz</p>
                    <p className="text-[11px] text-muted">{item.chargeSource === 'semester_entitlement' ? 'cota inclusa' : formatStatus(item.status)}</p>
                  </div>
                </div>
              </button>
            ))}

            {(summary?.recentUsage ?? []).length === 0 && (
              <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
                <p className="text-[13px] font-bold text-ink">Sem uso recente</p>
                <p className="text-[12px] text-muted mt-1">Quando você gerar documentos ou imagens, o histórico aparece aqui.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function formatNumber(value: number) {
  return String(Math.round(value))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatGenerationType(value: string) {
  const labels: Record<string, string> = {
    development_report: 'Relatório de desenvolvimento',
    class_diary: 'Diário de bordo',
    weekly_planning: 'Planejamento semanal',
    daily_lesson_plan: 'Plano de aula diário',
    pedagogical_project: 'Projeto pedagógico específico',
    specialist_referral: 'Encaminhamento para especialista',
    parents_meeting_record: 'Planejamento de reunião de pais',
    general_report: 'Relatório geral',
    planning: 'Planejamento',
    portfolio_text: 'Portfólio em texto',
    portfolio_image: 'Imagem de portfólio',
    audio_transcription: 'Transcrição de áudio',
    specialist_report: 'Encaminhamento',
    other: 'Documento',
  }
  return labels[value] ?? 'Documento'
}

function formatEntitlement(
  value: string,
  studentId: string | null,
  classes: ReturnType<typeof useAppStore.getState>['classes'],
) {
  const studentName = findStudentName(studentId, classes)
  if (value === 'development_report') return studentName ? `${studentName} - relatórios` : 'Relatórios de desenvolvimento'
  if (value === 'portfolio_image') return 'Imagens de portfólio do mês'
  return 'Cota inclusa'
}

function formatChargeSource(value: string) {
  if (value === 'semester_entitlement') return 'cota inclusa'
  if (value === 'giztokens') return 'GizTokens'
  if (value === 'paid_extra') return 'pacote extra'
  return 'Recurso'
}

function formatStatus(value: string) {
  if (value === 'completed') return 'concluído'
  if (value === 'estimated') return 'reservado'
  if (value === 'failed') return 'falhou'
  if (value === 'refunded') return 'estornado'
  return value
}

function findStudentName(studentId: string | null, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (!studentId) return null
  for (const classItem of classes) {
    const student = classItem.students.find((item) => item.id === studentId)
    if (student) return student.name
  }
  return null
}
