import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError } from '@/app/lib/ai-generation'
import { estimateTranscriptionCostCents, transcribeAudio } from '@/app/lib/ai-transcription'

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

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio inválido.' }, { status: 400, headers: CORS_HEADERS })
    }

    const durationSeconds = parseDurationSeconds(form.get('durationSeconds'))
    const classId = asString(form.get('classId'))
    const studentId = asString(form.get('studentId'))
    const requestSummary = parseRequestSummary(form.get('requestSummary'))
    const promptVersion = 'audio-transcription-v1'

    const reservation = await reserveTranscriptionUsage({
      ownerId,
      classId,
      studentId,
      promptVersion,
      requestSummary,
      durationSeconds,
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(reservation, { status: 402, headers: CORS_HEADERS })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? 0

    const transcription = await transcribeAudio({
      audio,
      durationSeconds,
    })

    await completeAiUsageReservation({
      logId: reservedLogId,
      actualCostCents: transcription.actualCostCents,
      resultSummary: {
        provider: transcription.provider,
        model: transcription.model,
        durationSeconds: transcription.durationSeconds,
        transcriptPreview: transcription.transcript.slice(0, 160),
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Audio transcrito com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        entitlement: reservation.entitlement,
        transcript: transcription.transcript,
        durationSeconds: transcription.durationSeconds,
        promptVersion,
        provider: transcription.provider,
        model: transcription.model,
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na transcrição de áudio.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/transcribe-audio] falha ao estornar reserva de IA', refundError)
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

    const message = error instanceof Error ? error.message : ''
    if (isMissingAudioGenerationTypeError(message)) {
      return NextResponse.json(
        { error: 'A base de dados ainda não foi atualizada para transcrição de áudio. Aplique a migration 0014 e tente novamente.' },
        { status: 500, headers: CORS_HEADERS },
      )
    }

    console.error('[ai/transcribe-audio] erro interno', error)

    return NextResponse.json(
      { error: 'Não foi possível transcrever o áudio agora. Tente novamente em instantes.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

function parseDurationSeconds(value: FormDataEntryValue | null) {
  const parsed = Number(typeof value === 'string' ? value : 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(30, Math.round(parsed))
}

function asString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseRequestSummary(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

async function reserveTranscriptionUsage(input: {
  ownerId: string
  classId: string | null
  studentId: string | null
  promptVersion: string
  requestSummary: Record<string, unknown>
  durationSeconds: number
}) {
  const summary = {
    ...input.requestSummary,
    durationSeconds: input.durationSeconds,
  }
  const estimatedCostCents = estimateTranscriptionCostCents(input.durationSeconds)
  const estimatedGiztokens = estimatedCostCents * 10

  try {
    return await reserveAiUsage({
      ownerId: input.ownerId,
      generationType: 'audio_transcription',
      classId: input.classId,
      studentId: input.studentId,
      promptVersion: input.promptVersion,
      pricingOverride: {
        provider: 'openai',
        model: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
        giztokens: estimatedGiztokens,
        estimatedCostCents,
        inputTokens: 0,
        outputTokens: 0,
        imageCount: 0,
      },
      requestSummary: summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!isMissingAudioGenerationTypeError(message)) {
      throw error
    }

    // Backward-compatible fallback for environments where enum migration was not applied yet.
    return await reserveAiUsage({
      ownerId: input.ownerId,
      generationType: 'other',
      classId: input.classId,
      studentId: input.studentId,
      promptVersion: input.promptVersion,
      pricingOverride: {
        provider: 'openai',
        model: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
        giztokens: estimatedGiztokens,
        estimatedCostCents,
        inputTokens: 0,
        outputTokens: 0,
        imageCount: 0,
      },
      requestSummary: {
        ...summary,
        generationSubtype: 'audio_transcription',
        migrationFallback: true,
      },
    })
  }
}

function isMissingAudioGenerationTypeError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('audio_transcription')
    && (normalized.includes('enum') || normalized.includes('invalid input value'))
}
