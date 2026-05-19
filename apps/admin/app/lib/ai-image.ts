import { createSupabaseServiceClient } from './supabase-server'
import { PublicAiGenerationError } from './ai-generation'
import type { AiGenerationType } from './ai-usage'

interface GeneratePortfolioImageInput {
  ownerId: string
  generationType: AiGenerationType
  classId?: string | null
  studentId?: string | null
  promptVersion: string
  requestSummary?: Record<string, unknown>
  logId: string
}

interface GeneratePortfolioImageResult {
  imageDataUrl: string
  prompt: string
  provider: string
  model: string
  size: string
  quality: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
  reportId: string
}

interface GenerateStandaloneImageInput {
  ownerId: string
  classId?: string | null
  studentId?: string | null
  promptVersion: string
  requestSummary?: Record<string, unknown>
  logId: string
}

interface GenerateStandaloneImageResult {
  imageDataUrl: string
  prompt: string
  provider: string
  model: string
  size: string
  quality: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
  reportId: string
}

const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_OPENAI_STANDALONE_IMAGE_MODEL = 'gpt-image-1-mini'
const DEFAULT_OPENAI_IMAGE_SIZE = '1024x1536'
const DEFAULT_OPENAI_IMAGE_QUALITY = 'high'
const DEFAULT_OPENAI_STANDALONE_IMAGE_QUALITY = 'medium'
const DEFAULT_OPENAI_IMAGE_COST_CENTS = 120
const DEFAULT_OPENAI_IMAGE_INPUT_COST_PER_MILLION_USD = 8
const DEFAULT_OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_USD = 30
const DEFAULT_OPENAI_STANDALONE_IMAGE_COST_CENTS = 60
const DEFAULT_OPENAI_STANDALONE_IMAGE_INPUT_COST_PER_MILLION_USD = 2
const DEFAULT_OPENAI_STANDALONE_IMAGE_OUTPUT_COST_PER_MILLION_USD = 8

export async function generatePortfolioImage(
  input: GeneratePortfolioImageInput,
): Promise<GeneratePortfolioImageResult> {
  const summary = input.requestSummary ?? {}
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL
  const size = resolvePortfolioImageSize(summary)
  const quality = resolvePortfolioImageQuality()
  const prompt = buildPortfolioImagePrompt(summary, size)

  const generated = await requestOpenAiImage({
    model,
    fallbackModels: resolvePortfolioImageFallbackModels(model),
    prompt,
    size,
    quality,
    user: input.ownerId,
    timeoutMs: 240000,
  })

  const actualCostCents = estimateOpenAiImageCostCents(generated.inputTokens, generated.outputTokens, 'portfolio')
  const body = buildPersistedImageBody({
    prompt,
    model: generated.model,
    size,
    quality,
  })

  const imageDataUrl = generated.image
  const reportId = await persistGeneratedReport(input, {
    reportType: input.generationType,
    artifactKind: 'portfolio_image',
    body,
    imageDataUrl,
    artifact: {
      prompt,
      model: generated.model,
      size,
      quality,
    },
  })
  await persistUsage(
    reportId,
    input.ownerId,
    'openai',
    generated.model,
    generated.inputTokens,
    generated.outputTokens,
    actualCostCents,
  )

  return {
    imageDataUrl,
    prompt,
    provider: 'openai',
    model: generated.model,
    size,
    quality,
    inputTokens: generated.inputTokens,
    outputTokens: generated.outputTokens,
    actualCostCents,
    reportId,
  }
}

export async function generateStandaloneImage(
  input: GenerateStandaloneImageInput,
): Promise<GenerateStandaloneImageResult> {
  const summary = input.requestSummary ?? {}
  const model = process.env.OPENAI_STANDALONE_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_STANDALONE_IMAGE_MODEL
  const size = resolveStandaloneImageSize(summary)
  const quality = resolveStandaloneImageQuality(summary)
  const prompt = buildStandaloneImagePrompt(summary, size)

  const generated = await requestOpenAiImage({
    model,
    prompt,
    size,
    quality,
    user: input.ownerId,
    timeoutMs: 180000,
  })

  const actualCostCents = estimateOpenAiImageCostCents(generated.inputTokens, generated.outputTokens, 'standalone')
  const body = buildPersistedStandaloneImageBody({
    prompt,
    size,
    quality,
  })

  const imageDataUrl = generated.image
  const reportId = await persistGeneratedReport(input, {
    reportType: 'generated_image',
    artifactKind: 'generated_image',
    body,
    imageDataUrl,
    artifact: {
      prompt,
      model,
      size,
      quality,
    },
  })
  await persistUsage(
    reportId,
    input.ownerId,
    'openai',
    model,
    generated.inputTokens,
    generated.outputTokens,
    actualCostCents,
  )

  return {
    imageDataUrl,
    prompt,
    provider: 'openai',
    model,
    size,
    quality,
    inputTokens: generated.inputTokens,
    outputTokens: generated.outputTokens,
    actualCostCents,
    reportId,
  }
}

async function requestOpenAiImage(input: {
  model: string
  fallbackModels?: string[]
  prompt: string
  size: string
  quality: string
  user: string
  timeoutMs?: number
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de imagem indisponivel no momento. Tente novamente em instantes.')
  }

  const models = [input.model, ...(input.fallbackModels ?? [])]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)

  let lastErrorMessage = ''

  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 180000)
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          n: 1,
          size: input.size,
          quality: input.quality,
          background: 'opaque',
          moderation: 'low',
          output_format: 'png',
          user: input.user,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PublicAiGenerationError('A criação da imagem demorou mais do que o esperado. Tente novamente.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: Array<{ b64_json?: string; url?: string }>
      usage?: {
        input_tokens?: number
        output_tokens?: number
        total_tokens?: number
      }
      error?: { message?: string; code?: string; type?: string }
    } | null

    if (!response.ok) {
      lastErrorMessage = payload?.error?.message ?? `HTTP ${response.status}`
      console.error('[ai-image] OpenAI HTTP', response.status, model, payload?.error)
      if (shouldTryNextImageModel(payload?.error?.message, payload?.error?.code, response.status, models, model)) {
        continue
      }
      throw new PublicAiGenerationError(toPublicImageErrorMessage(response.status, payload?.error?.message))
    }

    const b64Json = payload?.data?.[0]?.b64_json
    const imageUrl = payload?.data?.[0]?.url
    const image = b64Json ? `data:image/png;base64,${b64Json}` : imageUrl
    if (!image) {
      lastErrorMessage = 'Resposta sem imagem'
      console.error('[ai-image] OpenAI sem imagem', model, payload)
      continue
    }

    return {
      image,
      model,
      inputTokens: payload?.usage?.input_tokens ?? payload?.usage?.total_tokens ?? 0,
      outputTokens: payload?.usage?.output_tokens ?? 0,
    }
  }

  console.error('[ai-image] falha em todos os modelos', lastErrorMessage)
  throw new PublicAiGenerationError('Não foi possível criar a imagem agora. Tente novamente em instantes.')
}

function buildPortfolioImagePrompt(summary: Record<string, unknown>, size: string) {
  const studentName = asString(summary.studentName) ?? 'crianca'
  const className = asString(summary.className) ?? 'turma'
  const selectedAnnotations = asObjectArray(summary.selectedAnnotations)
  const extraContext = asString(summary.extraContext)
  const blankContext = asString(summary.blankContext)
  const attachments = asObjectArray(summary.attachments)

  const observations = selectedAnnotations.length
    ? selectedAnnotations.map((item) => {
        const label = asString(item.label) ?? 'registro'
        const text = asString(item.text) ?? ''
        return `- ${label}: ${text}`
      }).join('\n')
    : blankContext || 'Use as informacoes pedagogicas fornecidas pela professora.'

  const attachmentList = attachments.length
    ? attachments.map((item) => `- ${asString(item.name) ?? 'arquivo anexado'}`).join('\n')
    : 'Sem anexos visuais autorizados.'

  const formatLabel = size === '1536x1024' ? 'paisagem' : size === '1024x1024' ? 'quadrado' : 'retrato'
  return `Crie uma imagem unica de portfolio pedagogico de desenvolvimento para educacao infantil com qualidade profissional premium, semelhante a um material editorial/Canva profissional para escola.

Direcao visual obrigatoria:
- imagem no formato ${formatLabel}, tamanho ${size}, em alta qualidade, com acabamento profissional, limpo e pronto para compartilhar;
- estilo pedagogico brasileiro, acolhedor, infantil, sofisticado e colorido em tons pastel;
- layout de pagina unica, bem diagramado, com margens generosas, cards arredondados, icones consistentes e hierarquia visual clara;
- usar composicao tipo portfolio escolar premium: titulo, identificacao, campos de experiencia BNCC, avancos, proximos passos e pequenos registros visuais;
- incluir titulo grande e correto: "PORTFOLIO PEDAGOGICO DE DESENVOLVIMENTO";
- incluir subtitulo correto: "EDUCACAO INFANTIL";
- incluir nome da crianca: "${studentName}";
- incluir turma: "${className}";
- representar os campos da BNCC com icones/cores e textos curtos: "O eu, o outro e o nos", "Corpo, gestos e movimentos", "Tracos, sons, cores e formas", "Escuta, fala, pensamento e imaginacao", "Espacos, tempos, quantidades, relacoes e transformacoes";
- criar areas "Avancos e conquistas" e "Proximos passos", com frases curtas e legiveis;
- se houver pouca informacao, prefira menos texto e melhor acabamento visual, sem preencher com frases inventadas longas;
- evitar texto pequeno demais, letras deformadas, erros ortograficos, blocos lotados, poluicao visual e excesso de elementos;
- nao criar diagnosticos, comparacoes entre criancas, nota, ranking, selo de desempenho ou linguagem avaliativa;
- nao representar outras criancas identificaveis;
- nao usar marcas d'agua, logotipos externos, QR code, texto em ingles ou assinatura de IA.

Informacoes pedagogicas para preencher o painel:
${observations}

Orientacao extra da professora:
${extraContext || 'Valorizar conquistas, autonomia, linguagem, brincadeiras, interacoes e proximos passos.'}

Anexos informados pela professora:
${attachmentList}

Importante:
- Priorize qualidade visual e leitura. A imagem deve parecer feita por designer profissional para Educacao Infantil.
- Todo texto visivel deve estar em portugues brasileiro, com grafia correta.
- A imagem deve seguir a BNCC da Educacao Infantil (0 a 5 anos) sem parecer laudo clinico.`
}

function resolvePortfolioImageSize(summary: Record<string, unknown>) {
  const fromSummary = asString(summary.portfolioImageFormat)?.trim().toLowerCase()
  if (fromSummary === 'landscape') return '1536x1024'
  if (fromSummary === 'square') return '1024x1024'
  if (fromSummary === 'portrait') return '1024x1536'
  const fromEnv = process.env.OPENAI_IMAGE_SIZE?.trim()
  return fromEnv || DEFAULT_OPENAI_IMAGE_SIZE
}

function resolvePortfolioImageQuality() {
  const requested = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase() || DEFAULT_OPENAI_IMAGE_QUALITY
  if (requested === 'low' || requested === 'medium' || requested === 'high' || requested === 'auto') return requested
  return DEFAULT_OPENAI_IMAGE_QUALITY
}

function resolvePortfolioImageFallbackModels(model: string) {
  const configured = process.env.OPENAI_IMAGE_FALLBACK_MODEL?.trim()
  const fallbacks = configured ? [configured] : ['gpt-image-1']
  return fallbacks.filter((item) => item !== model)
}

function resolveStandaloneImageSize(summary: Record<string, unknown>) {
  const requested = asString(summary.description)?.toLowerCase() || ''
  if (requested.includes('horizontal') || requested.includes('paisagem') || requested.includes('landscape')) {
    return '1536x1024'
  }
  if (requested.includes('quadrada') || requested.includes('quadrado') || requested.includes('square')) {
    return '1024x1024'
  }
  if (requested.includes('vertical') || requested.includes('retrato') || requested.includes('portrait')) {
    return '1024x1536'
  }
  const fromEnv = process.env.OPENAI_IMAGE_SIZE?.trim()
  return fromEnv || DEFAULT_OPENAI_IMAGE_SIZE
}

function resolveStandaloneImageQuality(summary: Record<string, unknown>) {
  const requested = asString(summary.imageQuality)?.trim().toLowerCase()
  if (requested === 'standard' || requested === 'padrao' || requested === 'padrão') return 'medium'
  if (requested === 'medium' || requested === 'media' || requested === 'média') return 'medium'
  if (requested === 'high' || requested === 'alta') return 'high'
  return process.env.OPENAI_STANDALONE_IMAGE_QUALITY?.trim() || DEFAULT_OPENAI_STANDALONE_IMAGE_QUALITY
}

function buildStandaloneImagePrompt(summary: Record<string, unknown>, size: string) {
  const description = asString(summary.description)?.trim()
  if (!description) {
    throw new PublicAiGenerationError('Descreva a imagem para continuar.')
  }

  return `Crie uma imagem de alta qualidade com base na descrição abaixo.

Requisitos:
- Use português brasileiro quando houver texto visível.
- Respeite fielmente estilo, cores, cenário, orientação e formato pedidos.
- Tamanho final: ${size}.
- Evite elementos ofensivos, diagnósticos médicos, marcas externas ou conteúdo impróprio para ambiente escolar.

Descrição da professora:
${description}`
}

function buildPersistedImageBody(input: {
  prompt: string
  model: string
  size: string
  quality: string
}) {
  return `Imagem de portfolio pedagogico gerada com OpenAI.

Modelo: ${input.model}
Tamanho: ${input.size}
Qualidade: ${input.quality}

Prompt usado:

${input.prompt}`
}

function buildPersistedStandaloneImageBody(input: {
  prompt: string
  size: string
  quality: string
}) {
  return `Imagem criada com sucesso.

Tamanho: ${input.size}
Qualidade: ${input.quality}

Descrição usada:

${input.prompt}`
}

async function persistGeneratedReport(
  input: GeneratePortfolioImageInput | GenerateStandaloneImageInput,
  payload: {
    reportType: string
    artifactKind: string
    body: string
    imageDataUrl: string
    artifact: { prompt: string; model: string; size: string; quality: string }
  },
) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reports')
    .insert({
      owner_id: input.ownerId,
      student_id: input.studentId ?? null,
      class_id: input.classId ?? null,
      status: 'ready',
      report_type: payload.reportType,
      prompt_version: input.promptVersion,
      body: payload.body,
      ai_artifacts: {
        kind: payload.artifactKind,
        imageDataUrl: payload.imageDataUrl,
        prompt: payload.artifact.prompt,
        model: payload.artifact.model,
        size: payload.artifact.size,
        quality: payload.artifact.quality,
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new PublicAiGenerationError('Nao foi possivel salvar a imagem gerada. Tente novamente.')
  }

  return data.id
}

async function persistUsage(
  reportId: string,
  ownerId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costCents: number,
) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('reports_usage').insert({
    owner_id: ownerId,
    report_id: reportId,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: costCents,
  })

  if (error) throw toError(error, 'Nao foi possivel registrar consumo da imagem.')
}

function resolveOpenAiImageCostCents(profile: 'portfolio' | 'standalone') {
  const envKey = profile === 'standalone'
    ? process.env.OPENAI_STANDALONE_IMAGE_COST_CENTS
    : process.env.OPENAI_IMAGE_COST_CENTS
  const fromEnv = Number(envKey)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return profile === 'standalone' ? DEFAULT_OPENAI_STANDALONE_IMAGE_COST_CENTS : DEFAULT_OPENAI_IMAGE_COST_CENTS
}

function estimateOpenAiImageCostCents(
  inputTokens: number,
  outputTokens: number,
  profile: 'portfolio' | 'standalone',
) {
  const normalizedInputTokens = Math.max(0, inputTokens)
  const normalizedOutputTokens = Math.max(0, outputTokens)
  if (normalizedInputTokens <= 0 && normalizedOutputTokens <= 0) {
    return resolveOpenAiImageCostCents(profile)
  }

  const inputUsd = (normalizedInputTokens / 1_000_000) * resolveOpenAiImageInputUsdPerMillion(profile)
  const outputUsd = (normalizedOutputTokens / 1_000_000) * resolveOpenAiImageOutputUsdPerMillion(profile)
  const brl = (inputUsd + outputUsd) * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brl * 100))
}

function resolveOpenAiImageInputUsdPerMillion(profile: 'portfolio' | 'standalone') {
  const envKey = profile === 'standalone'
    ? process.env.OPENAI_STANDALONE_IMAGE_INPUT_COST_PER_MILLION_USD
    : process.env.OPENAI_IMAGE_INPUT_COST_PER_MILLION_USD
  const fromEnv = Number(envKey)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return profile === 'standalone'
    ? DEFAULT_OPENAI_STANDALONE_IMAGE_INPUT_COST_PER_MILLION_USD
    : DEFAULT_OPENAI_IMAGE_INPUT_COST_PER_MILLION_USD
}

function resolveOpenAiImageOutputUsdPerMillion(profile: 'portfolio' | 'standalone') {
  const envKey = profile === 'standalone'
    ? process.env.OPENAI_STANDALONE_IMAGE_OUTPUT_COST_PER_MILLION_USD
    : process.env.OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_USD
  const fromEnv = Number(envKey)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return profile === 'standalone'
    ? DEFAULT_OPENAI_STANDALONE_IMAGE_OUTPUT_COST_PER_MILLION_USD
    : DEFAULT_OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_USD
}

function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
}

function shouldTryNextImageModel(
  message: string | undefined,
  code: string | undefined,
  status: number,
  models: string[],
  currentModel: string,
) {
  if (models.indexOf(currentModel) >= models.length - 1) return false
  const normalized = `${message ?? ''} ${code ?? ''}`.toLowerCase()
  return status === 400 && (
    normalized.includes('model')
    || normalized.includes('quality')
    || normalized.includes('size')
    || normalized.includes('unsupported')
    || normalized.includes('invalid')
  )
}

function toPublicImageErrorMessage(status: number, message?: string) {
  const normalized = (message ?? '').toLowerCase()
  if (status === 429) return 'O serviço de imagem está muito usado no momento. Tente novamente em alguns minutos.'
  if (normalized.includes('content_policy') || normalized.includes('safety') || normalized.includes('moderation')) {
    return 'Não foi possível criar a imagem com essa descrição. Ajuste o texto e tente novamente.'
  }
  if (normalized.includes('billing') || normalized.includes('quota')) {
    return 'O serviço de imagem está sem saldo/configuração no momento.'
  }
  return 'Não foi possível criar a imagem agora. Tente novamente em instantes.'
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
