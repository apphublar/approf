import { useEffect } from 'react'
import { useNavStore } from '@/store'

interface PedagogicalGeneratorProps {
  data?: unknown
}

/** Redireciona para o Criador Pedagógico livre (sem formulários pré-definidos). */
export default function PedagogicalGeneratorSubscreen({ data }: PedagogicalGeneratorProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()

  useEffect(() => {
    const navData = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
    const docKind = typeof navData.docKind === 'string' ? navData.docKind.trim() : ''
    closeSubscreen()
    openSubscreen('report', {
      unifiedCreator: true,
      documentTitle: docKind || undefined,
    })
  }, [closeSubscreen, data, openSubscreen])

  return null
}
