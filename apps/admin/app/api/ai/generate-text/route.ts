import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
  type AiGenerationType,
} from '@/app/lib/ai-usage'
import {
  generatePedagogicalText,
  PublicAiGenerationError,
  rollbackGeneratedArtifacts,
} from '@/app/lib/ai-generation'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const TEXT_GENERATION_TYPES = new Set<AiGenerationType>([
  'development_report',
  'classroom_journal',
  'class_diary',
  'planning_weekly',
  'weekly_planning',
  'planning_daily',
  'daily_lesson_plan',
  'planning_project',
  'pedagógical_project',
  'planning_meeting',
  'specialist_referral',
  'parents_meeting',
  'parents_meeting_record',
  'general_report',
  'planning',
  'portfolio_text',
  'specialist_report',
  'other',
])

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let logId: string | undefined
  let reservationCompleted = false
  let reservedEstimatedCostCents = 0
  let generatedReportId: string | undefined
  let ownerIdForRollback: string | undefined
  const requestId = crypto.randomUUID()

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    ownerIdForRollback = ownerId
    const body = await request.json()
    const generationType = parseGenerationType(body.generationType)
    const requestSummary = isObjectRecord(body.requestSummary) ? body.requestSummary : {}
    const promptVersion = typeof body.promptVersion === 'string' && body.promptVersion.trim()
      ? body.promptVersion.trim()
      : 'bncc-v1'

    console.log('[GENERATE-TEXT] Request recebido:', {
      requestId,
      generationType,
      userId: ownerId,
      temAluno: typeof body.studentId === 'string',
      temTurma: typeof body.classId === 'string',
      timestamp: new Date().toISOString(),
    })

    console.log('[GENERATE-TEXT] Reservando uso de IA:', {
      requestId,
      generationType,
      promptVersion,
    })

    const reservation = await reserveAiUsage({
      ownerId,
      generationType,
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary,
      pricingOverride: resolveInterventionPricingOverride(requestSummary),
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      console.warn('[GENERATE-TEXT] Reserva negada:', {
        requestId,
        generationType,
        reason: reservation.reason,
        hasWallet: Boolean(reservation.wallet),
        hasEntitlement: Boolean(reservation.entitlement),
      })
      return NextResponse.json(reservation, { status: 402, headers: CORS_HEADERS })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? 0

    console.log('[GENERATE-TEXT] Reserva aprovada:', {
      requestId,
      generationType,
      logId: reservedLogId,
      chargeSource: reservation.chargeSource,
      estimatedCostCents: reservedEstimatedCostCents,
    })

    const generated = await generatePedagogicalText({
      ownerId,
      generationType,
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion,
      requestSummary,
      logId: reservedLogId,
      requestId,
    })
    generatedReportId = generated.reportId

    console.log('[GENERATE-TEXT] Texto gerado e relatório salvo:', {
      requestId,
      generationType,
      logId: reservedLogId,
      reportId: generated.reportId,
      provider: generated.provider,
      model: generated.model,
      pipeline: generated.pipeline,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      actualCostCents: generated.actualCostCents,
    })

    console.log('[GENERATE-TEXT] Finalizando reserva:', {
      requestId,
      logId: reservedLogId,
      reportId: generated.reportId,
    })

    await completeAiUsageReservation({
      logId: reservedLogId,
      actualCostCents: generated.actualCostCents,
      resultSummary: {
        reportId: generated.reportId,
        provider: generated.provider,
        model: generated.model,
        pipeline: generated.pipeline,
        stages: generated.pipelineStages,
      },
    })
    reservationCompleted = true

    console.log('[GENERATE-TEXT] Geração concluída:', {
      requestId,
      generationType,
      logId: reservedLogId,
      reportId: generated.reportId,
    })

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Geração concluida com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        entitlement: reservation.entitlement,
        generatedText: generated.text,
        reportId: generated.reportId,
        promptVersion: generated.promptVersion,
        provider: generated.provider,
        model: generated.model,
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      if (generatedReportId && ownerIdForRollback) {
        try {
          console.warn('[GENERATE-TEXT] Limpando artefatos parciais:', {
            requestId,
            logId,
            reportId: generatedReportId,
          })
          await rollbackGeneratedArtifacts({
            reportId: generatedReportId,
            ownerId: ownerIdForRollback,
          })
        } catch (rollbackError) {
          console.error('[GENERATE-TEXT] Falha ao limpar artefatos parciais:', {
            requestId,
            logId,
            reportId: generatedReportId,
            error: sanitizeLogError(rollbackError),
          })
        }
      }

      try {
        console.warn('[GENERATE-TEXT] Estornando reserva após falha:', {
          requestId,
          logId,
          reservedEstimatedCostCents,
        })
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na geração textual.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[GENERATE-TEXT] Falha ao estornar reserva de IA:', {
          requestId,
          logId,
          error: sanitizeLogError(refundError),
        })
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

    console.error('[GENERATE-TEXT] Erro:', {
      requestId,
      logId,
      generatedReportId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })

    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Não foi possível concluir a geração agora. Tente novamente em instantes.'

    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

function sanitizeLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
    }
  }

  return { message: String(error) }
}

function parseGenerationType(value: unknown): AiGenerationType {
  if (typeof value === 'string' && TEXT_GENERATION_TYPES.has(value as AiGenerationType)) {
    return value as AiGenerationType
  }
  throw new Error('Tipo de geração textual inválido.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function resolveInterventionPricingOverride(summary: Record<string, unknown>) {
  const mode = summary.interventionMode
  if (mode !== 'suggestions' && mode !== 'feedback_analysis') return undefined
  return {
    provider: 'openai',
    model: process.env.OPENAI_INTERVENTIONS_MODEL?.trim() || 'gpt-4o-mini',
    estimatedCostCents: mode === 'suggestions' ? 35 : 28,
    giztokens: mode === 'suggestions' ? 350 : 280,
    inputTokens: mode === 'suggestions' ? 2200 : 2000,
    outputTokens: mode === 'suggestions' ? 1300 : 1100,
  }
}
