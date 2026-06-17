import { PageHeader } from '../components/PageHeader'
import { requireAdminSession } from '../lib/admin-auth'
import { listContinuityRequestsForAdmin } from '../lib/continuity'
import { ContinuityRequestsPanel } from './ContinuityRequestsPanel'

export const dynamic = 'force-dynamic'

export default async function ContinuityPage() {
  await requireAdminSession()
  const requests = await listContinuityRequestsForAdmin()

  return (
    <div className="admin-page-wrap admin-page-wrap-narrow">
      <PageHeader
        eyebrow="Pessoas"
        title="Continuidade pedagógica"
        description="Transferência de histórico de aluno entre professoras. Acesso completo só após aprovação."
      />
      <ContinuityRequestsPanel initialRequests={requests} />
    </div>
  )
}
