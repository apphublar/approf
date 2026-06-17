import { PageHeader } from '../components/PageHeader'
import { resolveAnnouncementAudience } from '../lib/announcements'
import { listSentAnnouncements } from '../lib/announcements'
import { AnnouncementComposer, AnnouncementHistory } from './AnnouncementComposer'

export const dynamic = 'force-dynamic'

export default async function AvisosPage() {
  const [history, todas, pagando, trial, atraso, verificadas] = await Promise.all([
    listSentAnnouncements(),
    resolveAnnouncementAudience('todas'),
    resolveAnnouncementAudience('pagando'),
    resolveAnnouncementAudience('trial'),
    resolveAnnouncementAudience('atraso'),
    resolveAnnouncementAudience('verificadas'),
  ])

  return (
    <div className="admin-page-wrap">
      <PageHeader
        eyebrow="Comunicação"
        title="Avisos no app"
        description="Envie um aviso que aparece dentro do app das professoras. Escolha o público, o tipo e veja a pré-visualização antes de enviar."
      />

      <AnnouncementComposer
        audienceCounts={{
          todas: todas.length,
          pagando: pagando.length,
          trial: trial.length,
          atraso: atraso.length,
          verificadas: verificadas.length,
        }}
      />

      <AnnouncementHistory items={history} />
    </div>
  )
}
