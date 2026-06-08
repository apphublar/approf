import { redirect } from 'next/navigation'

type CoordinatorRedirectPageProps = {
  params: Promise<{ token: string }>
}

export default async function CoordinatorRedirectPage({ params }: CoordinatorRedirectPageProps) {
  const { token } = await params
  const coordinatorOrigin = resolveCoordinatorOrigin()

  redirect(`${coordinatorOrigin}/coordenadora/${encodeURIComponent(token)}`)
}

function resolveCoordinatorOrigin() {
  const candidates = [
    process.env.NEXT_PUBLIC_COORDINATOR_PUBLIC_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    'https://admin.approf.com.br',
  ]

  const origin = candidates
    .map((value) => value?.trim().replace(/\/$/, ''))
    .find((value): value is string => typeof value === 'string' && value.length > 0 && !isSiteRootOrigin(value))

  return origin ?? 'https://admin.approf.com.br'
}

function isSiteRootOrigin(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return url.hostname === 'approf.com.br' || url.hostname === 'www.approf.com.br'
  } catch {
    return false
  }
}
