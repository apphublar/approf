export function StatusBadge({ status }: { status: string }) {
  const normalized = status.replaceAll('_', '-')
  const labels: Record<string, string> = {
    published: 'Aprovado',
    draft: 'Rascunho',
    archived: 'Arquivado',
    blocked: 'Bloqueado',
    review_required: 'Revisão necessária',
    em_analise: 'Em análise',
    free: 'Gratuito',
    paid_ok: 'Em dia',
    active: 'Ativa',
    trial: 'Teste',
    overdue: 'Em atraso',
    canceled: 'Cancelada',
    pending: 'Em análise',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
  }
  return <span className={`badge badge-${normalized}`}>{labels[status] ?? status}</span>
}
