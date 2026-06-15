import CoordinatorDocumentClient from '../../../../admin/app/coordenadora/documento/[token]/document-client'

type CoordinatorDocumentRedirectPageProps = {
  params: Promise<{ token: string }>
}

export default async function CoordinatorDocumentRedirectPage({ params }: CoordinatorDocumentRedirectPageProps) {
  const { token } = await params
  return <CoordinatorDocumentClient token={token} />
}
