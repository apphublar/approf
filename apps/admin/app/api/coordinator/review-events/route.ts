import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function GET(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
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
    return NextResponse.json({ events: data ?? [] }, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de revisão.' }, { status: 500, headers: corsHeaders })
  }
}
