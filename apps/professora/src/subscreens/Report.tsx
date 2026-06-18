import CreatorV2Screen from '@/creator-v2/CreatorV2Screen'

interface ReportSubscreenProps {
  data?: unknown
}

/** Criador Pedagógico v2 — fluxos guiado, portfólio visual e criação livre. */
export default function ReportSubscreen({ data }: ReportSubscreenProps) {
  return <CreatorV2Screen data={data} />
}
