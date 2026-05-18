import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError, rollbackGeneratedArtifacts } from '@/app/lib/ai-generation'
import { generateStandaloneImage } from '@/app/lib/ai-image'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const GIZTOKENS_PER_COST_CENT = 10

type ImageQuality = 'medium' | 'high'

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
    const quality = parseImageQuality(body.quality)
    const promptVersion = typeof body.promptVersion === 'string' && body.promptVersion.trim()
      ? body.promptVersion.trim()
      : 'standalone-image-v1'
    const requestSummary = isObjectRecord(body.requestSummary) ? body.requestSummary : {}

    const reservation = await reserveAiUsage({
      ownerId,
      generationType: 'other',
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary,
      pricingOverride: buildQualityEstimate(quality),
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(
        {
          ...reservation,
          message: reservation.message || 'Você não possui GizTokens suficientes para criar esta imagem.',
        },
        { status: 402, headers: CORS_HEADERS },
      )
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? 0

    const generated = await generateStandaloneImage({
      ownerId,
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary: {
        ...requestSummary,
        imageQuality: quality,
      },
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
        pipeline: 'openai-standalone-image',
        size: generated.size,
        quality: generated.quality,
        imageKind: 'generated_image',
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Imagem criada com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        imageDataUrl: generated.imageDataUrl,
        prompt: generated.prompt,
        quality,
        reportId: generated.reportId,
        promptVersion,
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
          console.error('[ai/generate-image] falha ao limpar artefatos parciais', rollbackError)
        }
      }

      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na geração de imagem.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/generate-image] falha ao estornar reserva', refundError)
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json(
        { error: 'Sessão expirada. Entre novamente para continuar.' },
        { status: error.status, headers: CORS_HEADERS },
      )
    }

    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    console.error('[ai/generate-image] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível criar a imagem. Tente novamente.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

function parseImageQuality(value: unknown): ImageQuality {
  if (value === 'medium' || value === 'high') return value
  return 'medium'
}

function buildQualityEstimate(quality: ImageQuality) {
  const baseCostCents = resolveBaseEstimatedImageCostCents()
  const adjustedCostCents = quality === 'high'
    ? Math.round(baseCostCents * 1.25)
    : Math.round(baseCostCents * 0.85)

  const estimatedCostCents = Math.max(1, adjustedCostCents)
  return {
    estimatedCostCents,
    giztokens: estimatedCostCents * GIZTOKENS_PER_COST_CENT,
  }
}

function resolveBaseEstimatedImageCostCents() {
  const fromEnv = Number(process.env.OPENAI_STANDALONE_IMAGE_ESTIMATED_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return 110
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
