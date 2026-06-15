import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createCoordinatorDocumentShare } from '@/app/lib/coordinator-review'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : ''
    const coordinatorName = typeof body.coordinatorName === 'string' ? body.coordinatorName.trim() : ''
    const coordinatorEmail = typeof body.coordinatorEmail === 'string' ? body.coordinatorEmail.trim() : ''

    if (!reportId || !coordinatorName || !coordinatorEmail) {
      return NextResponse.json({ error: 'Informe documento, nome e e-mail da coordenadora.' }, { status: 400, headers: CORS_HEADERS })
    }

    const origin = resolveCoordinatorPublicOrigin(new URL(request.url).origin)
    const result = await createCoordinatorDocumentShare({
      ownerId,
      reportId,
      coordinatorName,
      coordinatorEmail,
      origin,
    })
    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[coordinator/share-document] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível enviar o documento.' },
      { status: 400, headers: CORS_HEADERS },
    )
  }
}

function resolveCoordinatorPublicOrigin(requestOrigin: string) {
  const customCoordinatorUrl = process.env.NEXT_PUBLIC_COORDINATOR_PUBLIC_URL?.trim().replace(/\/$/, '')
    || process.env.COORDINATOR_PUBLIC_URL?.trim().replace(/\/$/, '')
  if (customCoordinatorUrl && !isLocalhostOrigin(customCoordinatorUrl)) return customCoordinatorUrl

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (siteUrl && !isLocalhostOrigin(siteUrl)) return siteUrl

  const cleanRequestOrigin = requestOrigin.replace(/\/$/, '')
  if (cleanRequestOrigin && !isLocalhostOrigin(cleanRequestOrigin)) return cleanRequestOrigin

  return 'https://approf.com.br'
}

function isLocalhostOrigin(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
  } catch {
    return false
  }
}
