import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError, rollbackGeneratedArtifacts } from '@/app/lib/ai-generation'
import { generateStandaloneImage } from '@/app/lib/ai-image'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'

export const maxDuration = 300

const GIZTOKENS_PER_COST_CENT = 10

type ImageQuality = 'standard'

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
      pricingOverride: buildQualityEstimate(),
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(
        {
          ...reservation,
          message: reservation.message || 'Você não possui GizTokens suficientes para criar esta imagem.',
        },
        { status: 402, headers: corsHeaders },
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
        { status: error.status, headers: corsHeaders },
      )
    }

    if (error instanceof PublicAiGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders },
      )
    }

    console.error('[ai/generate-image] erro interno', error)
    return NextResponse.json(
      { error: 'Não foi possível criar a imagem. Tente novamente.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

function parseImageQuality(value: unknown): ImageQuality {
  if (value === 'standard') return value
  return 'standard'
}

function buildQualityEstimate() {
  const baseCostCents = resolveBaseEstimatedImageCostCents()
  const estimatedCostCents = Math.max(1, Math.round(baseCostCents))
  return {
    provider: 'openai',
    model: resolveStandaloneImageModel(),
    estimatedCostCents,
    giztokens: estimatedCostCents * GIZTOKENS_PER_COST_CENT,
    imageCount: 1,
    inputTokens: 0,
    outputTokens: 0,
  }
}

function resolveBaseEstimatedImageCostCents() {
  const fromEnv = Number(process.env.OPENAI_STANDALONE_IMAGE_ESTIMATED_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return 110
}

function resolveStandaloneImageModel() {
  return process.env.OPENAI_STANDALONE_IMAGE_MODEL?.trim() || 'gpt-image-1-mini'
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
