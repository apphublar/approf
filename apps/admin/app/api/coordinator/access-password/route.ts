import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import {
  getTeacherCoordinatorAccessPasswordStatus,
  saveTeacherCoordinatorAccessPassword,
} from '@/app/lib/coordinator-review'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const status = await getTeacherCoordinatorAccessPasswordStatus(ownerId)
    return NextResponse.json(status, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[coordinator/access-password] GET erro', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível carregar a senha da coordenadora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

async function savePassword(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const password = typeof body.password === 'string' ? body.password.trim() : ''
    if (!password) {
      return NextResponse.json({ error: 'Informe a senha de acesso.' }, { status: 400, headers: corsHeaders })
    }
    const result = await saveTeacherCoordinatorAccessPassword(ownerId, password)
    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401, headers: corsHeaders })
    }
    console.error('[coordinator/access-password] save erro', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível salvar a senha.' },
      { status: 400, headers: corsHeaders },
    )
  }
}

export async function PUT(request: Request) {
  return savePassword(request)
}

export async function POST(request: Request) {
  return savePassword(request)
}
