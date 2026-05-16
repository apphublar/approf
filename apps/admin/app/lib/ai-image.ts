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

const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_OPENAI_IMAGE_SIZE = '1024x1536'
const DEFAULT_OPENAI_IMAGE_QUALITY = 'high'
const DEFAULT_OPENAI_IMAGE_COST_CENTS = 120

export async function generatePortfolioImage(
  input: GeneratePortfolioImageInput,
): Promise<GeneratePortfolioImageResult> {
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL
  const size = process.env.OPENAI_IMAGE_SIZE?.trim() || DEFAULT_OPENAI_IMAGE_SIZE
  const quality = process.env.OPENAI_IMAGE_QUALITY?.trim() || DEFAULT_OPENAI_IMAGE_QUALITY
  const prompt = buildPortfolioImagePrompt(input.requestSummary ?? {})

  const generated = await requestOpenAiImage({
    model,
    prompt,
    size,
    quality,
    user: input.ownerId,
  })

  const actualCostCents = resolveOpenAiImageCostCents()
  const body = buildPersistedImageBody({
    prompt,
    model,
    size,
    quality,
  })

  const reportId = await persistGeneratedReport(input, body, `data:image/png;base64,${generated.b64Json}`, {
    prompt,
    model,
    size,
    quality,
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
    imageDataUrl: `data:image/png;base64,${generated.b64Json}`,
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
  prompt: string
  size: string
  quality: string
  user: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de imagem indisponivel no momento. Tente novamente em instantes.')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      n: 1,
      size: input.size,
      quality: input.quality,
      user: input.user,
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }
    error?: { message?: string }
  } | null

  if (!response.ok) {
    console.error('[ai-image] OpenAI HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Nao foi possivel gerar a imagem agora. Tente novamente em instantes.')
  }

  const b64Json = payload?.data?.[0]?.b64_json
  if (!b64Json) {
    throw new PublicAiGenerationError('A IA nao retornou uma imagem valida. Ajuste o contexto e tente novamente.')
  }

  return {
    b64Json,
    inputTokens: payload?.usage?.input_tokens ?? payload?.usage?.total_tokens ?? 0,
    outputTokens: payload?.usage?.output_tokens ?? 0,
  }
}

function buildPortfolioImagePrompt(summary: Record<string, unknown>) {
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

  return `Crie uma imagem vertical unica de portfolio pedagogico de desenvolvimento para educacao infantil com qualidade profissional premium, semelhante a um material editorial/Canva profissional para escola.

Direcao visual obrigatoria:
- imagem vertical 1024x1536, em alta qualidade, com acabamento profissional, limpo e pronto para compartilhar;
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

async function persistGeneratedReport(
  input: GeneratePortfolioImageInput,
  body: string,
  imageDataUrl: string,
  artifact: { prompt: string; model: string; size: string; quality: string },
) {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reports')
    .insert({
      owner_id: input.ownerId,
      student_id: input.studentId ?? null,
      class_id: input.classId ?? null,
      status: 'ready',
      report_type: input.generationType,
      prompt_version: input.promptVersion,
      body,
      ai_artifacts: {
        kind: 'portfolio_image',
        imageDataUrl,
        prompt: artifact.prompt,
        model: artifact.model,
        size: artifact.size,
        quality: artifact.quality,
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

function resolveOpenAiImageCostCents() {
  const fromEnv = Number(process.env.OPENAI_IMAGE_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return DEFAULT_OPENAI_IMAGE_COST_CENTS
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
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
