import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import {
  DEFAULT_OPENAI_CHAT_MODEL,
  DEFAULT_OPENAI_TEXT_INPUT_COST_PER_MILLION_USD,
  DEFAULT_OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD,
  resolveOpenAiModel,
  withOpenAiTemperature,
} from '@/app/lib/openai-models'

type ChatProvider = 'openai'
type ChatMessage = { role: 'user' | 'assistant'; content: string }

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
    const body = await request.json()
    const provider = parseProvider(body.provider)
    const messages = parseMessages(body.messages)
    if (messages.length === 0) {
      return NextResponse.json({ error: 'Envie pelo menos uma mensagem no chat.' }, { status: 400, headers: corsHeaders })
    }

    const estimate = buildPricingEstimate(provider, messages)
    const reservation = await reserveAiUsage({
      ownerId,
      generationType: 'other',
      classId: typeof body.classId === 'string' ? body.classId : null,
      studentId: typeof body.studentId === 'string' ? body.studentId : null,
      promptVersion: 'chat-v1',
      requestSummary: isObjectRecord(body.requestSummary) ? body.requestSummary : {},
      pricingOverride: estimate,
    })

    const reservedLogId = reservation.logId
    if (!reservation.allowed || !reservedLogId) {
      return NextResponse.json(reservation, { status: 402, headers: corsHeaders })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? estimate.estimatedCostCents

    const result = await requestOpenAiChat(messages)

    await completeAiUsageReservation({
      logId: reservedLogId,
      actualCostCents: result.actualCostCents,
      resultSummary: {
        provider,
        model: result.model,
        pipeline: 'chat',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
    reservationCompleted = true

    return NextResponse.json(
      {
        allowed: true,
        message: reservation.message || 'Resposta gerada com sucesso.',
        chargeSource: reservation.chargeSource,
        wallet: reservation.wallet,
        entitlement: reservation.entitlement,
        response: result.text,
        provider,
        model: result.model,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    if (logId && !reservationCompleted) {
      try {
        await refundAiUsageReservation({
          logId,
          reason: error instanceof Error ? error.message : 'Falha na resposta do chat.',
          reservedCostCentsOverride: reservedEstimatedCostCents,
        })
      } catch (refundError) {
        console.error('[ai/chat] falha ao estornar reserva de IA', refundError)
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json(
        { error: 'Sessão expirada. Entre novamente para continuar.' },
        { status: error.status, headers: corsHeaders },
      )
    }

    console.error('[ai/chat] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível responder no chat agora.' },
      { status: 500, headers: corsHeaders },
    )
  }
}

function parseProvider(value: unknown): ChatProvider {
  if (value === 'openai') return value
  return 'openai'
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => {
      const role: ChatMessage['role'] = item.role === 'assistant' ? 'assistant' : 'user'
      return {
        role,
        content: typeof item.content === 'string' ? item.content.trim() : '',
      }
    })
    .filter((item) => item.content.length > 0)
    .slice(-16)
}

function buildPricingEstimate(provider: ChatProvider, messages: ChatMessage[]) {
  const textLength = messages.reduce((acc, message) => acc + message.content.length, 0)
  const estimatedInputTokens = Math.max(300, Math.round(textLength / 3))
  const estimatedOutputTokens = 500
  const estimatedCostCents = estimateOpenAiCostCents(estimatedInputTokens, estimatedOutputTokens)
  return {
    provider,
    model: resolveOpenAiChatModel(),
    estimatedCostCents,
    giztokens: Math.max(20, estimatedCostCents * 10),
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    imageCount: 0,
  }
}

async function requestOpenAiChat(messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Serviço GPT indisponível no momento.')
  const model = resolveOpenAiChatModel()
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(withOpenAiTemperature({
      model,
      messages: [
        { role: 'system', content: 'Você é um assistente útil, claro e cordial para professoras de educação infantil. Responda em português brasileiro. Escreva sempre em texto corrido e limpo, sem formatação Markdown: sem asteriscos, sem hashtags, sem traços de lista, sem backticks, sem negrito nem itálico.' },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }, model, 0.5)),
  })
  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    error?: { message?: string }
  } | null

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Não foi possível responder com GPT agora.')
  }

  const raw = payload?.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('O GPT não retornou resposta suficiente.')
  const inputTokens = payload?.usage?.prompt_tokens ?? 0
  const outputTokens = payload?.usage?.completion_tokens ?? 0
  return {
    text: stripMarkdown(raw),
    model,
    inputTokens,
    outputTokens,
    actualCostCents: estimateOpenAiCostCents(inputTokens, outputTokens),
  }
}

function stripMarkdown(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/^={3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resolveOpenAiChatModel() {
  return resolveOpenAiModel(process.env.OPENAI_CHAT_MODEL, DEFAULT_OPENAI_CHAT_MODEL)
}

function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

function resolveOpenAiInputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_INPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return DEFAULT_OPENAI_TEXT_INPUT_COST_PER_MILLION_USD
}

function resolveOpenAiOutputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return DEFAULT_OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD
}

function estimateOpenAiCostCents(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens / 1_000_000) * resolveOpenAiInputUsdPerMillion()
    + (outputTokens / 1_000_000) * resolveOpenAiOutputUsdPerMillion()
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
