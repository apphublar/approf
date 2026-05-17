import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { PublicAiGenerationError } from '@/app/lib/ai-generation'
import { transcribeAudio } from '@/app/lib/ai-transcription'

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
      return NextResponse.json({ error: 'Audio invalido.' }, { status: 400, headers: CORS_HEADERS })
    }

    const durationSeconds = parseDurationSeconds(form.get('durationSeconds'))
    const classId = asString(form.get('classId'))
    const studentId = asString(form.get('studentId'))
    const requestSummary = parseRequestSummary(form.get('requestSummary'))
    const promptVersion = 'audio-transcription-v1'

    const reservation = await reserveAiUsage({
      ownerId,
      generationType: 'audio_transcription',
      classId,
      studentId,
      promptVersion,
      requestSummary: {
        ...requestSummary,
        durationSeconds,
      },
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
          reason: error instanceof Error ? error.message : 'Falha na transcricao de audio.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/transcribe-audio] falha ao estornar reserva de IA', refundError)
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

    console.error('[ai/transcribe-audio] erro interno', error)

    return NextResponse.json(
      { error: 'Nao foi possivel transcrever o audio agora. Tente novamente em instantes.' },
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
