import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { getTeacherAccountData, updateTeacherProfile } from '@/app/lib/account'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[account/get] erro interno', error)
    return NextResponse.json({ error: 'Não foi possível carregar sua conta agora.' }, { status: 500, headers: corsHeaders })
  }
}

export async function PATCH(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    await updateTeacherProfile(ownerId, {
      fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
      phone: typeof body.phone === 'string' || body.phone === null ? (body.phone as string | null) : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      avatarUrl: typeof body.avatarUrl === 'string' || body.avatarUrl === null ? (body.avatarUrl as string | null) : undefined,
      schoolLogoUrl: typeof body.schoolLogoUrl === 'string' || body.schoolLogoUrl === null ? (body.schoolLogoUrl as string | null) : undefined,
      notificationPreferences:
        body.notificationPreferences && typeof body.notificationPreferences === 'object' && !Array.isArray(body.notificationPreferences)
          ? (body.notificationPreferences as Record<string, unknown>)
          : undefined,
    })
    const account = await getTeacherAccountData(ownerId)
    return NextResponse.json(account, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[account/update] erro interno', error)
    return NextResponse.json({ error: 'Não foi possível atualizar seus dados agora.' }, { status: 500, headers: corsHeaders })
  }
}
