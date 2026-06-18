import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError, rollbackGeneratedArtifacts } from '@/app/lib/ai-generation'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import {
  buildCreatorPromptPreview,
  generateCreatorTextDocument,
  loadCreatorNotes,
} from '@/app/lib/creator-v2/generate'
import { mapDocumentTypeToGenerationType } from '@/app/lib/creator-v2/mapping'
import { parseCreatorPayload } from '@/app/lib/creator-v2/parse'
import { estimateTextReservationCostCents } from '@/app/lib/openai-cost'

export const maxDuration = 300

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  let logId: string | undefined
  let reservationCompleted = false
  let reservedEstimatedCostCents = 0
  let generatedReportId: string | undefined
  let ownerIdForRollback: string | undefined
  const requestId = crypto.randomUUID()

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    ownerIdForRollback = ownerId
    const body = await request.json() as Record<string, unknown>
    const payload = parseCreatorPayload(body)
    const promptVersion = typeof body.promptVersion === 'string' && body.promptVersion.trim()
      ? body.promptVersion.trim()
      : 'creator-v2'

    if (payload.outputFormat === 'image') {
      return NextResponse.json(
        { error: 'Use o endpoint de imagem para este tipo de saída.' },
        { status: 400, headers: corsHeaders },
      )
    }

    const classId = typeof body.classId === 'string' ? body.classId : payload.classContext?.id ?? null
    const studentId = typeof body.studentId === 'string' ? body.studentId : payload.studentContext?.id ?? null
    const generationType = mapDocumentTypeToGenerationType(payload.documentType)
    const notes = await loadCreatorNotes(ownerId, payload)
    const preview = buildCreatorPromptPreview(payload, notes)
    const estimatedCostCents = estimateTextReservationCostCents(preview.user)

    const reservation = await reserveAiUsage({
      ownerId,
      generationType,
      classId,
      studentId,
      promptVersion,
      requestSummary: {
        creatorV2: true,
        mode: payload.mode,
        documentType: payload.documentType,
        sourceMode: payload.sourceMode,
        title: payload.title ?? null,
        teacherPrompt: payload.teacherPrompt,
        notesCount: notes.length,
        requestId,
      },
      pricingOverride: {
        provider: 'openai',
        model: 'creator-v2-single-shot',
        estimatedCostCents,
        giztokens: estimatedCostCents * 10,
        inputTokens: Math.ceil(preview.user.length / 4),
        outputTokens: 1800,
        imageCount: 0,
      },
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(reservation, { status: 402, headers: corsHeaders })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? estimatedCostCents

    const generated = await generateCreatorTextDocument({
      ownerId,
      payload,
      promptVersion,
      classId,
      studentId,
    })
    generatedReportId = generated.reportId

    await completeAiUsageReservation({
      logId: reservedLogId,
      actualCostCents: generated.actualCostCents,
      resultSummary: {
        reportId: generated.reportId,
        provider: generated.provider,
        model: generated.model,
        pipeline: generated.pipeline,
        mode: payload.mode,
        documentType: payload.documentType,
        sourceMode: payload.sourceMode,
        notesCount: notes.length,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        giztokensCharged: generated.actualCostCents * 10,
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Documento gerado com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        entitlement: reservation.entitlement,
        generatedText: generated.text,
        reportId: generated.reportId,
        promptVersion,
        provider: generated.provider,
        model: generated.model,
        actualCostCents: generated.actualCostCents,
        giztokensCharged: generated.actualCostCents * 10,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      if (generatedReportId && ownerIdForRollback) {
        try {
          await rollbackGeneratedArtifacts({ reportId: generatedReportId, ownerId: ownerIdForRollback })
        } catch {
          // ignore rollback failure
        }
      }
      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na geração creator-v2.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch {
        // ignore refund failure
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: error.status, headers: corsHeaders })
    }
    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders })
    }

    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Não foi possível gerar o documento agora.'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
