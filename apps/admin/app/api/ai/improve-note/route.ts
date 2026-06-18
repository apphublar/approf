import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError } from '@/app/lib/ai-generation'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { improveTextWithOpenAi } from '@/app/lib/creator-v2/generate'
import { buildImproveNoteUser, parseImproveNotePayload } from '@/app/lib/creator-v2/parse'
import { IMPROVE_NOTE_SYSTEM } from '@/app/lib/creator-v2/prompts'
import { estimateImproveReservationCostCents } from '@/app/lib/openai-cost'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  let logId: string | undefined
  let reservationCompleted = false
  let reservedEstimatedCostCents = 0

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json() as Record<string, unknown>
    const payload = parseImproveNotePayload(body)
    const userPrompt = buildImproveNoteUser(payload)
    const estimatedCostCents = estimateImproveReservationCostCents(payload.noteText)

    const reservation = await reserveAiUsage({
      ownerId,
      generationType: 'other',
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion: 'creator-improve-note-v1',
      requestSummary: { kind: 'improve_note' },
      pricingOverride: {
        provider: 'openai',
        model: 'creator-improve-note',
        estimatedCostCents,
        giztokens: estimatedCostCents * 10,
        inputTokens: Math.ceil(userPrompt.length / 4),
        outputTokens: 500,
        imageCount: 0,
      },
    })

    if (!reservation.allowed || !reservation.logId) {
      return NextResponse.json(reservation, { status: 402, headers: corsHeaders })
    }

    logId = reservation.logId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? estimatedCostCents

    const result = await improveTextWithOpenAi(IMPROVE_NOTE_SYSTEM, userPrompt)

    await completeAiUsageReservation({
      logId: reservation.logId,
      actualCostCents: result.actualCostCents,
      resultSummary: {
        kind: 'improve_note',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        giztokensCharged: result.actualCostCents * 10,
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        improvedText: result.text,
        actualCostCents: result.actualCostCents,
        giztokensCharged: result.actualCostCents * 10,
        message: reservation.message,
        wallet: reservation.wallet,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha ao aprimorar anotação.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch {
        // ignore
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada.' }, { status: error.status, headers: corsHeaders })
    }
    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível aprimorar a anotação.' },
      { status: 500, headers: corsHeaders },
    )
  }
}
