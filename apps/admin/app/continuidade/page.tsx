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
        title="Continuidade pedagogica"
        description="Transferencia de historico de aluno entre professoras. Acesso completo so apos aprovacao."
      />
      <ContinuityRequestsPanel initialRequests={requests} />
    </div>
  )
}
