import CoordinatorDocumentClient from './document-client'

export default async function CoordinatorDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <CoordinatorDocumentClient token={token} />
}
