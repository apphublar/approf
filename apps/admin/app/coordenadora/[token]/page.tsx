import CoordinatorReviewClient from './review-client'

export default async function CoordinatorReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <CoordinatorReviewClient token={token} />
}
