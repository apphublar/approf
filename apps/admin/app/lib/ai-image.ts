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
  inputImageDataUrl?: string | null
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

const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1'
const DEFAULT_OPENAI_STANDALONE_IMAGE_MODEL = 'gpt-image-1-mini'
const DEFAULT_OPENAI_IMAGE_SIZE = '1024x1536'
const DEFAULT_OPENAI_IMAGE_QUALITY = 'medium'
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
  const prompt = input.inputImageDataUrl
    ? buildPortfolioImageEditPrompt(summary, size)
    : buildPortfolioImagePrompt(summary, size)

  const generated = input.inputImageDataUrl
    ? await requestOpenAiImageEdit({
        model,
        inputImageDataUrl: input.inputImageDataUrl,
        prompt,
        size,
        quality,
        user: input.ownerId,
        timeoutMs: 270000,
      })
    : await requestOpenAiImage({
        model,
        fallbackModels: resolvePortfolioImageFallbackModels(model),
        prompt,
        size,
        quality,
        user: input.ownerId,
        timeoutMs: 270000,
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
    model: generated.model,
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
      model: generated.model,
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
    model: generated.model,
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
    throw new PublicAiGenerationError('Servico de imagem indisponÃ­vel no momento. Tente novamente em instantes.')
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
        throw new PublicAiGenerationError('A criaÃ§Ã£o da imagem demorou mais do que o esperado. Tente novamente.')
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

async function requestOpenAiImageEdit(input: {
  model: string
  inputImageDataUrl: string
  prompt: string
  size: string
  quality: string
  user: string
  timeoutMs?: number
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Serviço de imagem indisponível no momento. Tente novamente em instantes.')
  }

  const separatorIdx = input.inputImageDataUrl.indexOf(',')
  if (separatorIdx < 0) {
    throw new PublicAiGenerationError('Foto inválida. Tente novamente com outra imagem.')
  }
  const header = input.inputImageDataUrl.slice(0, separatorIdx)
  const base64 = input.inputImageDataUrl.slice(separatorIdx + 1)
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'

  const imageBytes = Buffer.from(base64, 'base64')
  const imageBlob = new Blob([imageBytes], { type: mimeType })

  const form = new FormData()
  form.append('model', input.model)
  form.append('image[]', imageBlob, `photo.${ext}`)
  form.append('prompt', input.prompt)
  form.append('n', '1')
  form.append('size', input.size)
  form.append('quality', input.quality)
  form.append('output_format', 'png')
  form.append('user', input.user)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 180000)
  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
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
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
    error?: { message?: string; code?: string }
  } | null

  if (!response.ok) {
    console.error('[ai-image] OpenAI edit HTTP', response.status, input.model, payload?.error)
    throw new PublicAiGenerationError(toPublicImageErrorMessage(response.status, payload?.error?.message))
  }

  const b64Json = payload?.data?.[0]?.b64_json
  const imageUrl = payload?.data?.[0]?.url
  const image = b64Json ? `data:image/png;base64,${b64Json}` : imageUrl
  if (!image) {
    throw new PublicAiGenerationError('Não foi possível criar a imagem agora. Tente novamente em instantes.')
  }

  return {
    image,
    model: input.model,
    inputTokens: payload?.usage?.input_tokens ?? payload?.usage?.total_tokens ?? 0,
    outputTokens: payload?.usage?.output_tokens ?? 0,
  }
}

function buildPortfolioImagePrompt(summary: Record<string, unknown>, size: string) {
  const studentName = asString(summary.studentName) ?? 'criança'
  const className = asString(summary.className) ?? 'turma'
  const selectedAnnotations = asObjectArray(summary.selectedAnnotations)
  const extraContext = asString(summary.extraContext)?.trim()
  const blankContext = asString(summary.blankContext)
  const attachments = asObjectArray(summary.attachments)

  const observations = selectedAnnotations.length
    ? selectedAnnotations.map((item) => {
        const label = asString(item.label) ?? 'registro'
        const text = asString(item.text) ?? ''
        return `- ${label}: ${text}`
      }).join('\n')
    : blankContext || 'Nenhuma evidência específica foi informada pela professora. Não inventar conquistas, preferências, dificuldades ou acontecimentos.'

  const attachmentList = attachments.length
    ? attachments.map((item) => `- ${asString(item.name) ?? 'arquivo anexado'}`).join('\n')
    : 'Sem anexos visuais.'

  const teacherInstruction = extraContext
    ? `\nINSTRUÇÃO OBRIGATÓRIA DA PROFESSORA (seguir à risca):\n${extraContext}`
    : ''

  const formatLabel = size === '1536x1024' ? 'paisagem' : size === '1024x1024' ? 'quadrado' : 'retrato'
  return `Ilustração de portfólio pedagógico (${formatLabel}, ${size}) para Educação Infantil, estilo acolhedor em tons pastel, layout limpo tipo cartaz escolar.

Texto visível em português brasileiro:
- Título: PORTFÓLIO PEDAGÓGICO
- Subtítulo: EDUCAÇÃO INFANTIL
- Criança: ${studentName}
- Turma: ${className}
- Blocos curtos: Adaptação e convivência, Linguagem, Movimento e autonomia, Interesses, Família, Considerações finais

Regras: usar apenas evidências fornecidas pela professora; não inventar fatos sobre a criança; sem diagnóstico, sem comparação entre crianças, sem nota ou ranking, sem marcas d'água ou QR code, sem outras crianças identificáveis. Pouco texto, letras legíveis.

Conteúdo pedagógico real autorizado:
${observations}
${teacherInstruction}
Anexos: ${attachmentList}`
}

function buildPortfolioImageEditPrompt(summary: Record<string, unknown>, size: string) {
  const studentName = asString(summary.studentName) ?? 'criança'
  const className = asString(summary.className) ?? 'turma'
  const selectedAnnotations = asObjectArray(summary.selectedAnnotations)
  const selectedMilestones = asObjectArray(summary.selectedMilestones)
  const extraContext = asString(summary.extraContext)?.trim()
  const blankContext = asString(summary.blankContext)

  const allAnnotations = [...selectedAnnotations, ...selectedMilestones]
  const observations = allAnnotations.length
    ? allAnnotations.map((item) => {
        const label = asString(item.label) ?? 'registro'
        const text = asString(item.text) ?? ''
        return `- ${label}: ${text}`
      }).join('\n')
    : blankContext || 'Destacar principais conquistas e evolução da criança na rotina escolar.'

  const teacherInstruction = extraContext
    ? `\nINSTRUÇÃO OBRIGATÓRIA DA PROFESSORA — seguir à risca, inclusive pedidos de posição da foto ou remoção de informações:\n${extraContext}`
    : ''

  const isLandscape = size === '1536x1024'
  const isSquare = size === '1024x1024'

  const layoutDesc = isLandscape
    ? `LAYOUT (paisagem):
- Lado ESQUERDO (~40% da largura): foto real da criança, altura total, com moldura suave em tons pastel
- Ao LADO DIREITO da foto: cabeçalho com PORTFÓLIO PEDAGÓGICO, nome "${studentName}", turma "${className}", linha para Professora, linha para Período 2026
- Abaixo do cabeçalho: blocos de texto com o conteúdo pedagógico`
    : isSquare
    ? `LAYOUT (quadrado):
- Terço SUPERIOR: foto real da criança centralizada com moldura suave pastel, ao lado: PORTFÓLIO PEDAGÓGICO, nome "${studentName}", turma "${className}"
- Dois terços INFERIORES: blocos com conteúdo pedagógico em fundo branco ou creme`
    : `LAYOUT (retrato — padrão):
- Terço SUPERIOR: foto real da criança à ESQUERDA (portrait dentro de uma moldura suave), ao lado direito: PORTFÓLIO PEDAGÓGICO em destaque, nome "${studentName}", turma "${className}", linha para Professora, Período 2026
- Dois terços INFERIORES: fundo branco ou creme, dividido em blocos arredondados com título em verde ou azul pastel e texto sobre o desenvolvimento`

  return `Crie um portfólio pedagógico visual completo para Educação Infantil usando a foto da criança fornecida como imagem real e preservada.

${layoutDesc}

REGRAS ABSOLUTAS:
- A foto da criança é REAL — não redesenhe, não ilustre, não substitua. Use-a exatamente como está.
- Fundo e decoração em tons pastel suaves (verde, azul, rosa, amarelo claro) — estilo acolhedor escolar.
- Texto em português brasileiro correto com acentos, letras legíveis.
- Sem marcas d'água, sem QR code, sem outras crianças identificáveis.
- Não inventar informações sobre a criança além do que está no conteúdo abaixo.
${teacherInstruction}
CONTEÚDO PEDAGÓGICO (preencha os blocos com estes dados):
${observations}`
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
  const fallbacks = configured ? [configured] : ['gpt-image-2', 'gpt-image-1-mini']
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
  if (requested === 'standard' || requested === 'padrao' || requested === 'padrÃ£o') return 'medium'
  if (requested === 'medium' || requested === 'media' || requested === 'mÃ©dia') return 'medium'
  if (requested === 'high' || requested === 'alta') return 'high'
  return process.env.OPENAI_STANDALONE_IMAGE_QUALITY?.trim() || DEFAULT_OPENAI_STANDALONE_IMAGE_QUALITY
}

function buildStandaloneImagePrompt(summary: Record<string, unknown>, size: string) {
  const description = asString(summary.description)?.trim()
  if (!description) {
    throw new PublicAiGenerationError('Descreva a imagem para continuar.')
  }

  return `Crie uma imagem de alta qualidade com base na descriÃ§Ã£o abaixo.

Requisitos:
- Use portuguÃªs brasileiro quando houver texto visÃ­vel.
- Respeite fielmente estilo, cores, cenÃ¡rio, orientaÃ§Ã£o e formato pedidos.
- Tamanho final: ${size}.
- Evite elementos ofensivos, diagnÃ³sticos mÃ©dicos, marcas externas ou conteÃºdo imprÃ³prio para ambiente escolar.

DescriÃ§Ã£o da professora:
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
  model: string
  size: string
  quality: string
}) {
  return `Imagem criada com sucesso.

Modelo: ${input.model}
Tamanho: ${input.size}
Qualidade: ${input.quality}

DescriÃ§Ã£o usada:

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
    throw new PublicAiGenerationError('NÃ£o foi possÃ­vel salvar a imagem gerada. Tente novamente.')
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

  if (error) throw toError(error, 'NÃ£o foi possÃ­vel registrar consumo da imagem.')
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
  return Math.max(0, Math.round(brl * 100))
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
  if (status === 429) return 'O serviÃ§o de imagem estÃ¡ muito usado no momento. Tente novamente em alguns minutos.'
  if (normalized.includes('content_policy') || normalized.includes('safety') || normalized.includes('moderation')) {
    return 'NÃ£o foi possÃ­vel criar a imagem com essa descriÃ§Ã£o. Ajuste o texto e tente novamente.'
  }
  if (normalized.includes('billing') || normalized.includes('quota')) {
    return 'O serviÃ§o de imagem estÃ¡ sem saldo/configuraÃ§Ã£o no momento.'
  }
  return 'NÃ£o foi possÃ­vel criar a imagem agora. Tente novamente em instantes.'
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
