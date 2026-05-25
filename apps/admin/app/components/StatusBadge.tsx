export function StatusBadge({ status }: { status: string }) {
  const normalized = status.replaceAll('_', '-')
  const labels: Record<string, string> = {
    published: 'Aprovado',
    draft: 'Rascunho',
    archived: 'Arquivado',
    blocked: 'Bloqueado',
    review_required: 'Revisao necessaria',
    em_analise: 'Em analise',
  }
  return <span className={`badge badge-${normalized}`}>{labels[status] ?? status}</span>
}
