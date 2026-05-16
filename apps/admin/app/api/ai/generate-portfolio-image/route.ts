import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError, rollbackGeneratedArtifacts } from '@/app/lib/ai-generation'
import { generatePortfolioImage } from '@/app/lib/ai-image'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let logId: string | undefined
  let reservationCompleted = false
  let reservedEstimatedCostCents = 0
  let generatedReportId: string | undefined
  let ownerIdForRollback: string | undefined

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    ownerIdForRollback = ownerId
    const body = await request.json()
    const promptVersion = typeof body.promptVersion === 'string' && body.promptVersion.trim()
      ? body.promptVersion.trim()
      : 'portfolio-image-v1'

    const reservation = await reserveAiUsage({
      ownerId,
      generationType: 'portfolio_image',
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary: isObjectRecord(body.requestSummary) ? body.requestSummary : {},
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(reservation, { status: 402, headers: CORS_HEADERS })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? 0

    const generated = await generatePortfolioImage({
      ownerId,
      generationType: 'portfolio_image',
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary: isObjectRecord(body.requestSummary) ? body.requestSummary : {},
      logId: reservedLogId,
    })
    generatedReportId = generated.reportId

    await completeAiUsageReservation({
      logId: reservedLogId,
      actualCostCents: generated.actualCostCents,
      resultSummary: {
        reportId: generated.reportId,
        provider: generated.provider,
        model: generated.model,
        pipeline: 'openai-portfolio-image',
        size: generated.size,
        quality: generated.quality,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Imagem gerada com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        entitlement: reservation.entitlement,
        imageDataUrl: generated.imageDataUrl,
        prompt: generated.prompt,
        reportId: generated.reportId,
        promptVersion,
        provider: generated.provider,
        model: generated.model,
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      if (generatedReportId && ownerIdForRollback) {
        try {
          await rollbackGeneratedArtifacts({
            reportId: generatedReportId,
            ownerId: ownerIdForRollback,
          })
        } catch (rollbackError) {
          console.error('[ai/generate-portfolio-image] falha ao limpar artefatos parciais', rollbackError)
        }
      }

      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na geracao de imagem.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/generate-portfolio-image] falha ao estornar reserva de IA', refundError)
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json(
        { error: 'Sessao expirada. Entre novamente para continuar.' },
        { status: error.status, headers: CORS_HEADERS },
      )
    }

    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    console.error('[ai/generate-portfolio-image] erro interno', error)

    return NextResponse.json(
      { error: 'Nao foi possivel concluir a imagem agora. Tente novamente em instantes.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
