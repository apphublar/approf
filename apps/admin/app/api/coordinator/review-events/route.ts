import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')?.trim()
    const classId = searchParams.get('classId')?.trim()
    const supabase = createSupabaseServiceClient()
    let query = supabase
      .from('report_review_events')
      .select('id,report_id,student_id,class_id,actor_type,actor_name,actor_email,action,notes,previous_status,next_status,created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (studentId) query = query.eq('student_id', studentId)
    if (classId) query = query.eq('class_id', classId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ events: data ?? [] }, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de revisão.' }, { status: 500, headers: CORS_HEADERS })
  }
}
