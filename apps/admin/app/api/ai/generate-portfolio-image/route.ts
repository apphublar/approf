import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError, rollbackGeneratedArtifacts } from '@/app/lib/ai-generation'
import { generatePortfolioImage } from '@/app/lib/ai-image'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'

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

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    ownerIdForRollback = ownerId
    const body = await request.json()
    const promptVersion = typeof body.promptVersion === 'string' && body.promptVersion.trim()
      ? body.promptVersion.trim()
      : 'portfolio-image-v1'
    const primaryPhotoDataUrl = typeof body.primaryPhotoDataUrl === 'string' && body.primaryPhotoDataUrl.startsWith('data:image/')
      ? body.primaryPhotoDataUrl
      : null

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
      return NextResponse.json(reservation, { status: 402, headers: corsHeaders })
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
      inputImageDataUrl: primaryPhotoDataUrl,
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
        quality: generated.quality,
        reportId: generated.reportId,
        promptVersion,
        provider: generated.provider,
        model: generated.model,
      },
      { status: 200, headers: corsHeaders },
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
          reason: error instanceof Error ? error.message : 'Falha na geração de imagem.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/generate-portfolio-image] falha ao estornar reserva de IA', refundError)
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json(
        { error: 'Sessão expirada. Entre novamente para continuar.' },
        { status: error.status, headers: corsHeaders },
      )
    }

    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders },
      )
    }

    console.error('[ai/generate-portfolio-image] erro interno', error)

    return NextResponse.json(
      { error: 'Não foi possível concluir a imagem agora. Tente novamente em instantes.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
