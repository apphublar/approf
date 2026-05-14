import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { reserveAiUsage, type AiGenerationType } from '@/app/lib/ai-usage'

const GENERATION_TYPES = new Set<AiGenerationType>([
  'development_report',
  'general_report',
  'planning',
  'portfolio_text',
  'portfolio_image',
  'specialist_report',
  'other',
])

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

    return NextResponse.json(result, { status: result.allowed ? 200 : 402 })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nao foi possivel reservar uso de IA.' },
      { status: 400 },
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
