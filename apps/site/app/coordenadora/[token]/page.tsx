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
    process.env.NEXT_PUBLIC_COORDINATOR_REVIEW_APP_URL,
    process.env.COORDINATOR_REVIEW_APP_URL,
    'https://approf-admin.vercel.app',
  ]

  const origin = candidates
    .map((value) => value?.trim().replace(/\/$/, ''))
    .find((value): value is string => typeof value === 'string' && value.length > 0 && !isPublicSiteOrigin(value))

  return origin ?? 'https://approf-admin.vercel.app'
}

function isPublicSiteOrigin(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return [
      'approf.com.br',
      'www.approf.com.br',
    ].includes(url.hostname)
  } catch {
    return false
  }
}
