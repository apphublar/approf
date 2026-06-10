import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { reserveAiUsage, type AiGenerationType } from '@/app/lib/ai-usage'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'

const GENERATION_TYPES = new Set<AiGenerationType>([
  'development_report',
  'class_diary',
  'weekly_planning',
  'daily_lesson_plan',
  'pedagogical_project',
  'specialist_referral',
  'parents_meeting_record',
  'general_report',
  'planning',
  'portfolio_text',
  'portfolio_image',
  'audio_transcription',
  'specialist_report',
  'other',
])

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json()
    const generationType = parseGenerationType(body.generationType)

    const result = await reserveAiUsage({
      ownerId,
      generationType,
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion: typeof body.promptVersion === 'string' ? body.promptVersion : undefined,
      requestSummary: isObjectRecord(body.requestSummary) ? body.requestSummary : {},
    })

    return NextResponse.json(result, { status: result.allowed ? 200 : 402, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível reservar uso de IA.' },
      { status: 400, headers: corsHeaders },
    )
  }
}

function parseGenerationType(value: unknown): AiGenerationType {
  if (typeof value === 'string' && GENERATION_TYPES.has(value as AiGenerationType)) {
    return value as AiGenerationType
  }
  throw new Error('Tipo de geração inválido.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
