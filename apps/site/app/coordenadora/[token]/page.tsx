import CoordinatorReviewClient from '../../../../admin/app/coordenadora/[token]/review-client'

type CoordinatorRedirectPageProps = {
  params: Promise<{ token: string }>
}

export default async function CoordinatorRedirectPage({ params }: CoordinatorRedirectPageProps) {
  const { token } = await params
  return <CoordinatorReviewClient token={token} />
}
