import { NextResponse } from 'next/server'
import { AiAuthError, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  completeAiUsageReservation,
  refundAiUsageReservation,
  reserveAiUsage,
} from '@/app/lib/ai-usage'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

type ChatProvider = 'openai' | 'anthropic'
type ChatMessage = { role: 'user' | 'assistant'; content: string }

const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-4o-mini'
const DEFAULT_ANTHROPIC_CHAT_MODEL = 'claude-3-5-haiku-latest'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let logId: string | undefined
  let reservationCompleted = false
  let reservedEstimatedCostCents = 0

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json()
    const provider = parseProvider(body.provider)
    const messages = parseMessages(body.messages)
    if (messages.length === 0) {
      return NextResponse.json({ error: 'Envie pelo menos uma mensagem no chat.' }, { status: 400, headers: CORS_HEADERS })
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
      return NextResponse.json(reservation, { status: 402, headers: CORS_HEADERS })
    }

    logId = reservedLogId
    reservedEstimatedCostCents = reservation.estimate?.estimatedCostCents ?? estimate.estimatedCostCents

    const result = provider === 'openai'
      ? await requestOpenAiChat(messages)
      : await requestAnthropicChat(messages)

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
      { status: 200, headers: CORS_HEADERS },
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
        { status: error.status, headers: CORS_HEADERS },
      )
    }

    console.error('[ai/chat] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível responder no chat agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

function parseProvider(value: unknown): ChatProvider {
  if (value === 'openai' || value === 'anthropic') return value
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
  const estimatedOutputTokens = provider === 'openai' ? 500 : 650
  const estimatedCostCents = provider === 'openai'
    ? estimateOpenAiCostCents(estimatedInputTokens, estimatedOutputTokens)
    : estimateAnthropicCostCents(resolveAnthropicChatModel(), estimatedInputTokens, estimatedOutputTokens)
  return {
    provider,
    model: provider === 'openai' ? resolveOpenAiChatModel() : resolveAnthropicChatModel(),
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
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: 'system', content: 'Você é um assistente útil, claro e cordial para professoras de educação infantil. Responda em português brasileiro. Escreva sempre em texto corrido e limpo, sem formatação Markdown: sem asteriscos, sem hashtags, sem traços de lista, sem backticks, sem negrito nem itálico.' },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
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

async function requestAnthropicChat(messages: ChatMessage[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Serviço Claude indisponível no momento.')
  const model = resolveAnthropicChatModel()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.5,
      system: 'Você é um assistente útil, claro e cordial para professoras de educação infantil. Responda em português brasileiro. Escreva sempre em texto corrido e limpo, sem formatação Markdown: sem asteriscos, sem hashtags, sem traços de lista, sem backticks, sem negrito nem itálico.',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  const payload = (await response.json().catch(() => null)) as {
    content?: Array<{ type?: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
    error?: { message?: string }
  } | null

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Não foi possível responder com Claude agora.')
  }

  const raw = payload?.content
    ?.filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('\n')
    .trim()
  if (!raw) throw new Error('O Claude não retornou resposta suficiente.')
  const inputTokens = payload?.usage?.input_tokens ?? 0
  const outputTokens = payload?.usage?.output_tokens ?? 0
  return {
    text: stripMarkdown(raw),
    model,
    inputTokens,
    outputTokens,
    actualCostCents: estimateAnthropicCostCents(model, inputTokens, outputTokens),
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
  const fromEnv = process.env.OPENAI_CHAT_MODEL?.trim()
  return fromEnv || DEFAULT_OPENAI_CHAT_MODEL
}

function resolveAnthropicChatModel() {
  const fromEnv = process.env.ANTHROPIC_CHAT_MODEL?.trim()
  return fromEnv || DEFAULT_ANTHROPIC_CHAT_MODEL
}

function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

function resolveOpenAiInputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_INPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 0.15
}

function resolveOpenAiOutputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 0.6
}

function estimateOpenAiCostCents(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens / 1_000_000) * resolveOpenAiInputUsdPerMillion()
    + (outputTokens / 1_000_000) * resolveOpenAiOutputUsdPerMillion()
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

function estimateAnthropicCostCents(model: string, inputTokens: number, outputTokens: number) {
  const m = model.toLowerCase()
  let inputCostPerMillion = 3
  let outputCostPerMillion = 15
  if (m.includes('haiku')) {
    inputCostPerMillion = 0.25
    outputCostPerMillion = 1.25
  } else if (m.includes('opus')) {
    inputCostPerMillion = 15
    outputCostPerMillion = 75
  }
  const usd = (inputTokens / 1_000_000) * inputCostPerMillion + (outputTokens / 1_000_000) * outputCostPerMillion
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
