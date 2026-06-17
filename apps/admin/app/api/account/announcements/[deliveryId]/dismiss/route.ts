import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { dismissAnnouncementDelivery } from '@/app/lib/announcements'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request, context: { params: Promise<{ deliveryId: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { deliveryId } = await context.params
    await dismissAnnouncementDelivery(ownerId, deliveryId)
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[announcements/dismiss] erro interno', error)
    return NextResponse.json({ error: 'Nao foi possivel dispensar o aviso agora.' }, { status: 500, headers: corsHeaders })
  }
}
