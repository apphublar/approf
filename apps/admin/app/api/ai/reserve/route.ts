import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { reserveAiUsage, type AiGenerationType } from '@/app/lib/ai-usage'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const GENERATION_TYPES = new Set<AiGenerationType>([
  'development_report',
  'general_report',
  'planning',
  'portfolio_text',
  'portfolio_image',
  'specialist_report',
  'other',
])

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
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

    return NextResponse.json(result, { status: result.allowed ? 200 : 402, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: CORS_HEADERS })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nao foi possivel reservar uso de IA.' },
      { status: 400, headers: CORS_HEADERS },
    )
  }
}

function parseGenerationType(value: unknown): AiGenerationType {
  if (typeof value === 'string' && GENERATION_TYPES.has(value as AiGenerationType)) {
    return value as AiGenerationType
  }
  throw new Error('Tipo de geracao invalido.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
