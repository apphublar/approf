import type { AiGenerationType } from './ai-usage'
import { createSupabaseServiceClient } from './supabase-server'
import type { BuildPromptInput } from './pedagogical-prompts'
import {
  buildStage1DraftPrompt,
  buildStage2BnccReviewPrompt,
  buildStage3FinalRefinementPrompt,
  pipelineStagePromptVersion,
} from './pedagogical-prompts'

interface GeneratePedagogicalTextInput {
  ownerId: string
  generationType: AiGenerationType
  classId?: string | null
  studentId?: string | null
  promptVersion: string
  requestSummary?: Record<string, unknown>
  logId: string
}

/** Metadados de uma etapa do pipeline (persistidos em ai_generation_logs.result_summary). */
export interface PipelineStageMetadata {
  stage: 1 | 2 | 3
  etapa: 'rascunho_pedagogico' | 'revisao_bncc_seguranca' | 'refinamento_final'
  provider: string
  model: string
  promptVersion: string
  inputTokens: number
  outputTokens: number
  /** Custo estimado a partir dos tokens (API nao retorna USD direto). */
  estimatedCostCents: number
  /** Igual a estimatedCostCents nesta integracao; reservado para futura fatura real. */
  actualCostCents: number
}

interface GeneratePedagogicalTextResult {
  text: string
  provider: string
  model: string
  pipeline: string
  promptVersion: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
  reportId: string
  pipelineStages: PipelineStageMetadata[]
}

export class PublicAiGenerationError extends Error {}

const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_OPENAI_INTERVENTIONS_MODEL = 'gpt-4o-mini'

function resolveAnthropicTextModelFallback(): string {
  const fromEnv = process.env.ANTHROPIC_TEXT_MODEL?.trim()
  return fromEnv || DEFAULT_ANTHROPIC_TEXT_MODEL
}

function resolveDraftModelId(): string {
  const v = process.env.ANTHROPIC_DRAFT_MODEL?.trim()
  return v || resolveAnthropicTextModelFallback()
}

function resolveReviewModelId(): string {
  const v = process.env.ANTHROPIC_REVIEW_MODEL?.trim()
  return v || resolveAnthropicTextModelFallback()
}

function resolveRefineModelId(): string {
  const v = process.env.ANTHROPIC_REFINE_MODEL?.trim()
  return v || resolveAnthropicTextModelFallback()
}

export async function generatePedagogicalText(
  input: GeneratePedagogicalTextInput,
): Promise<GeneratePedagogicalTextResult> {
  const summary = input.requestSummary ?? {}
  const promptInput = buildPromptInputFromSummary(input, summary)

  if (isInterventionMode(promptInput.interventionMode)) {
    return generateInterventionWithOpenAi(input, promptInput)
  }

  const modelDraft = resolveDraftModelId()
  const modelReview = resolveReviewModelId()
  const modelRefine = resolveRefineModelId()

  let reportId: string | null = null

  try {
    const stage1Prompt = buildStage1DraftPrompt(promptInput)
    const s1 = await runPipelineStage(1, stage1Prompt.system, stage1Prompt.user, {
      model: modelDraft,
      maxTokens: 2200,
      temperature: 0.35,
    })

    const stage2Prompt = buildStage2BnccReviewPrompt(promptInput, s1.text)
    const s2 = await runPipelineStage(2, stage2Prompt.system, stage2Prompt.user, {
      model: modelReview,
      maxTokens: 2400,
      temperature: 0.2,
    })

    const stage3Prompt = buildStage3FinalRefinementPrompt(promptInput, s2.text)
    const s3Initial = await runPipelineStage(3, stage3Prompt.system, stage3Prompt.user, {
      model: modelRefine,
      maxTokens: 2000,
      temperature: 0.45,
    })
    const structured = await ensureRequiredStructure({
      generationType: input.generationType,
      reportKind: promptInput.reportKind ?? promptInput.docKind,
      candidate: s3Initial,
      model: modelRefine,
    })
    const s3 = structured.completion

    const pipelineStages: PipelineStageMetadata[] = [
      toStageMeta(input.promptVersion, 1, 'rascunho_pedagogico', s1),
      toStageMeta(input.promptVersion, 2, 'revisao_bncc_seguranca', s2),
      toStageMeta(input.promptVersion, 3, 'refinamento_final', s3),
    ]

    const inputTokens = s1.inputTokens + s2.inputTokens + s3.inputTokens
    const outputTokens = s1.outputTokens + s2.outputTokens + s3.outputTokens
    const actualCostCents =
      s1.actualCostCents + s2.actualCostCents + s3.actualCostCents

    reportId = await persistGeneratedReport(input, s3.text)
    if (!reportId) {
      throw new PublicAiGenerationError('Nao foi possivel salvar o relatorio gerado. Tente novamente.')
    }

    await persistUsage(
      reportId,
      input.ownerId,
      'anthropic',
      `3stage:${s1.model}|${s2.model}|${s3.model}`,
      inputTokens,
      outputTokens,
      actualCostCents,
    )

    return {
      text: s3.text,
      provider: 'anthropic',
      model: s3.model,
      pipeline: 'claude-text-3-stage',
      promptVersion: input.promptVersion,
      inputTokens,
      outputTokens,
      actualCostCents,
      reportId,
      pipelineStages,
    }
  } catch (error) {
    if (reportId) {
      await rollbackGeneratedArtifacts({ reportId, ownerId: input.ownerId })
    }
    throw error
  }
}

async function generateInterventionWithOpenAi(
  input: GeneratePedagogicalTextInput,
  promptInput: BuildPromptInput,
): Promise<GeneratePedagogicalTextResult> {
  const prompt = buildStage1DraftPrompt(promptInput)
  const openAi = await requestOpenAiInterventionText({
    mode: promptInput.interventionMode as 'suggestions' | 'feedback_analysis',
    system: prompt.system,
    user: prompt.user,
    model: resolveOpenAiInterventionsModel(),
  })

  const pipelineStages: PipelineStageMetadata[] = [
    {
      stage: 1,
      etapa: 'rascunho_pedagogico',
      provider: 'openai',
      model: openAi.model,
      promptVersion: pipelineStagePromptVersion(input.promptVersion, 1),
      inputTokens: openAi.inputTokens,
      outputTokens: openAi.outputTokens,
      estimatedCostCents: openAi.actualCostCents,
      actualCostCents: openAi.actualCostCents,
    },
  ]

  const reportId = await persistGeneratedReport(input, openAi.text)
  await persistUsage(
    reportId,
    input.ownerId,
    'openai',
    openAi.model,
    openAi.inputTokens,
    openAi.outputTokens,
    openAi.actualCostCents,
  )

  return {
    text: openAi.text,
    provider: 'openai',
    model: openAi.model,
    pipeline: 'gpt-interventions',
    promptVersion: input.promptVersion,
    inputTokens: openAi.inputTokens,
    outputTokens: openAi.outputTokens,
    actualCostCents: openAi.actualCostCents,
    reportId,
    pipelineStages,
  }
}

async function ensureRequiredStructure(input: {
  generationType: AiGenerationType
  reportKind?: string
  candidate: Awaited<ReturnType<typeof requestClaudeText>>
  model: string
}) {
  const validation = validateRequiredStructure(input.generationType, input.reportKind, input.candidate.text)
  if (validation.ok) {
    return { completion: input.candidate }
  }

  const repair = await requestClaudeText(
    [
      'Voce e revisor final de qualidade BNCC para Educacao Infantil.',
      'Reescreva integralmente o documento para cumprir TODAS as secoes obrigatorias, sem inventar fatos novos.',
      'Mantenha linguagem formal, acolhedora, sem comparacao entre criancas e sem diagnostico clinico.',
      'Retorne APENAS o documento final completo.',
    ].join('\n'),
    [
      'DOCUMENTO ATUAL:',
      input.candidate.text.trim(),
      '',
      'SECOES OBRIGATORIAS AUSENTES OU INSUFICIENTES:',
      ...validation.missing.map((item) => `- ${item}`),
      '',
      'INSTRUCAO:',
      'Reorganize o texto e garanta que todas as secoes exigidas aparecam com titulos claros.',
    ].join('\n'),
    {
      model: input.model,
      maxTokens: 2200,
      temperature: 0.25,
    },
  )

  const merged = {
    ...repair,
    inputTokens: input.candidate.inputTokens + repair.inputTokens,
    outputTokens: input.candidate.outputTokens + repair.outputTokens,
    estimatedCostCents: input.candidate.estimatedCostCents + repair.estimatedCostCents,
    actualCostCents: input.candidate.actualCostCents + repair.actualCostCents,
  }

  const repairedValidation = validateRequiredStructure(input.generationType, input.reportKind, merged.text)
  if (!repairedValidation.ok) {
    throw new PublicAiGenerationError('Nao foi possivel estruturar o documento no formato BNCC obrigatorio. Tente ajustar o contexto e gerar novamente.')
  }

  return { completion: merged }
}

function validateRequiredStructure(generationType: AiGenerationType, reportKind: string | undefined, text: string) {
  if (generationType === 'planning') {
    const missing = [
      !hasAnyHeading(text, ['identificacao']) && 'Identificacao',
      !hasAnyHeading(text, ['tema', 'titulo']) && 'Tema/Titulo',
      !hasAnyHeading(text, ['faixa etaria']) && 'Faixa etaria',
      !hasAnyHeading(text, ['campos de experiencia']) && 'Campos de experiencia',
      !hasAnyHeading(text, ['objetivos de aprendizagem', 'objetivos de desenvolvimento', 'objetivo']) && 'Objetivos de aprendizagem/desenvolvimento',
      !hasAnyHeading(text, ['materiais']) && 'Materiais necessarios',
      !hasAnyHeading(text, ['desenvolvimento', 'passo a passo']) && 'Desenvolvimento/Passo a passo',
      !hasAnyHeading(text, ['avaliacao', 'observacao']) && 'Avaliacao/Observacao',
      !containsAny(text, ['inicio']) && 'Subsecao Inicio',
      !containsAny(text, ['conclusao', 'fechamento']) && 'Subsecao Conclusao/Fechamento',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  const isDevelopmentLike = generationType === 'development_report'
    || generationType === 'general_report'
    || normalize(reportKind ?? '').includes('desenvolvimento')

  if (isDevelopmentLike) {
    const missing = [
      !hasAnyHeading(text, ['informacoes basicas', 'identificacao']) && 'Informacoes basicas',
      !hasAnyHeading(text, ['descricao geral', 'adaptacao']) && 'Descricao geral e adaptacao',
      !hasAnyHeading(text, ['campos de experiencia']) && 'Desenvolvimento nos campos de experiencia',
      !hasAnyHeading(text, ['conquistas']) && 'Conquistas',
      !hasAnyHeading(text, ['pontos de atencao', 'apoio', 'acompanhamento']) && 'Pontos de atencao',
      !hasAnyHeading(text, ['observacoes finais', 'observacoes']) && 'Observacoes finais',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  return { ok: true, missing: [] as string[] }
}

function hasAnyHeading(text: string, candidates: string[]) {
  const lines = normalize(text).split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.some((line) => {
    const normalizedLine = line
      .replace(/^[-*]\s*/, '')
      .replace(/^\d+[\).:-]?\s*/, '')
      .replace(/^#+\s*/, '')
    return candidates.some((candidate) => normalizedLine.includes(normalize(candidate)))
  })
}

function containsAny(text: string, candidates: string[]) {
  const normalizedText = normalize(text)
  return candidates.some((candidate) => normalizedText.includes(normalize(candidate)))
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toStageMeta(
  basePromptVersion: string,
  stage: 1 | 2 | 3,
  etapa: PipelineStageMetadata['etapa'],
  completion: Awaited<ReturnType<typeof requestClaudeText>>,
): PipelineStageMetadata {
  return {
    stage,
    etapa,
    provider: completion.provider,
    model: completion.model,
    promptVersion: pipelineStagePromptVersion(basePromptVersion, stage),
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    estimatedCostCents: completion.estimatedCostCents,
    actualCostCents: completion.actualCostCents,
  }
}

async function runPipelineStage(
  stageNumber: 1 | 2 | 3,
  system: string,
  user: string,
  opts: { model: string; maxTokens: number; temperature: number },
) {
  try {
    return await requestClaudeText(system, user, opts)
  } catch (error) {
    console.error(`[ai-generation] falha na etapa ${stageNumber} do pipeline Claude`, error)
    throw error
  }
}

export async function rollbackGeneratedArtifacts(input: { reportId: string; ownerId: string }) {
  await deleteReportUsage(input.reportId, input.ownerId)
  await deleteReport(input.reportId, input.ownerId)
}

interface RequestClaudeOptions {
  model: string
  maxTokens?: number
  temperature?: number
}

interface RequestOpenAiInterventionOptions {
  mode: 'suggestions' | 'feedback_analysis'
  system: string
  user: string
  model: string
}

async function requestClaudeText(system: string, user: string, options: RequestClaudeOptions) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de IA indisponivel no momento. Tente novamente em instantes.')
  }

  const model = options.model
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1800,
      temperature: options.temperature ?? 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    content?: Array<{ type?: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
    error?: { message?: string }
  } | null

  if (!response.ok) {
    console.error('[ai-generation] Claude HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Nao foi possivel gerar o texto agora. Tente novamente em instantes.')
  }

  const text = payload?.content
    ?.filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text ?? '')
    .join('\n')
    .trim()

  if (!text) {
    throw new PublicAiGenerationError('A IA nao retornou conteudo suficiente. Ajuste o contexto e tente novamente.')
  }

  const inputTokens = payload?.usage?.input_tokens ?? 0
  const outputTokens = payload?.usage?.output_tokens ?? 0
  const estimatedCostCents = estimateClaudeCostCents(model, inputTokens, outputTokens)

  return {
    text,
    provider: 'anthropic',
    model,
    inputTokens,
    outputTokens,
    estimatedCostCents,
    actualCostCents: estimatedCostCents,
  }
}

async function requestOpenAiInterventionText(options: RequestOpenAiInterventionOptions) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de IA indisponivel no momento. Tente novamente em instantes.')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.35,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: options.mode === 'suggestions' ? 'intervention_suggestions' : 'intervention_feedback',
          strict: true,
          schema: options.mode === 'suggestions'
            ? interventionSuggestionsSchema()
            : interventionFeedbackSchema(),
        },
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    error?: { message?: string }
    model?: string
  } | null

  if (!response.ok) {
    console.error('[ai-generation] OpenAI HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Nao foi possivel gerar sugestoes agora. Tente novamente em instantes.')
  }

  const text = payload?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new PublicAiGenerationError('A IA nao retornou conteudo suficiente para intervencoes.')
  }

  const inputTokens = payload?.usage?.prompt_tokens ?? 0
  const outputTokens = payload?.usage?.completion_tokens ?? 0
  return {
    text,
    model: payload?.model ?? options.model,
    inputTokens,
    outputTokens,
    actualCostCents: estimateOpenAiInterventionCostCents(inputTokens, outputTokens),
  }
}

function buildPromptInputFromSummary(
  input: GeneratePedagogicalTextInput,
  summary: Record<string, unknown>,
): BuildPromptInput {
  return {
    generationType: input.generationType,
    promptVersion: input.promptVersion,
    reportKind: asString(summary.reportKind),
    docKind: asString(summary.docKind),
    studentName: asString(summary.studentName),
    className: asString(summary.className),
    ageGroup: asString(summary.ageGroup),
    evaluationPeriod: asString(summary.evaluationPeriod),
    mode: asString(summary.mode),
    selectedAnnotations: asObjectArray(summary.selectedAnnotations) as BuildPromptInput['selectedAnnotations'],
    ignoredNotes: asString(summary.ignoredNotes),
    blankContext: asString(summary.blankContext),
    extraContext: asString(summary.extraContext),
    objective: asString(summary.objective),
    theme: asString(summary.theme),
    bnccFields: asStringArray(summary.bnccFields),
    useAnnotations: asBoolean(summary.useAnnotations),
    attachments: asObjectArray(summary.attachments) as BuildPromptInput['attachments'],
    interventionMode: asInterventionMode(summary.interventionMode),
    observation: asString(summary.observation) ?? asString(summary.observationInitial),
    studentAge: asString(summary.studentAge),
    interventionChosen: asObject(summary.interventionChosen),
    teacherReturn: asString(summary.teacherReturn),
    returnChoice: asString(summary.returnChoice),
  }
}

async function persistGeneratedReport(input: GeneratePedagogicalTextInput, body: string) {
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
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new PublicAiGenerationError('Nao foi possivel salvar o relatorio gerado. Tente novamente.')
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

  if (error) throw toError(error, 'Nao foi possivel registrar consumo do relatorio.')
}

async function deleteReportUsage(reportId: string, ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('reports_usage')
    .delete()
    .eq('report_id', reportId)
    .eq('owner_id', ownerId)

  if (error) {
    throw toError(error, 'Nao foi possivel limpar uso parcial do relatorio.')
  }
}

async function deleteReport(reportId: string, ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId)
    .eq('owner_id', ownerId)

  if (error) {
    throw toError(error, 'Nao foi possivel limpar relatorio parcial apos falha.')
  }
}

function estimateClaudeCostCents(model: string, inputTokens: number, outputTokens: number) {
  const m = model.toLowerCase()
  let inputCostPerMillion: number
  let outputCostPerMillion: number
  if (m.includes('haiku')) {
    inputCostPerMillion = 0.25
    outputCostPerMillion = 1.25
  } else if (m.includes('sonnet')) {
    inputCostPerMillion = 3
    outputCostPerMillion = 15
  } else if (m.includes('opus')) {
    inputCostPerMillion = 15
    outputCostPerMillion = 75
  } else {
    inputCostPerMillion = 3
    outputCostPerMillion = 15
  }
  const usd = (inputTokens / 1_000_000) * inputCostPerMillion + (outputTokens / 1_000_000) * outputCostPerMillion
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

function estimateOpenAiInterventionCostCents(inputTokens: number, outputTokens: number) {
  const inputUsdPerMillion = resolveOpenAiTextInputUsdPerMillion()
  const outputUsdPerMillion = resolveOpenAiTextOutputUsdPerMillion()
  const usd = (inputTokens / 1_000_000) * inputUsdPerMillion + (outputTokens / 1_000_000) * outputUsdPerMillion
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

function resolveOpenAiInterventionsModel() {
  const fromEnv = process.env.OPENAI_INTERVENTIONS_MODEL?.trim()
  return fromEnv || DEFAULT_OPENAI_INTERVENTIONS_MODEL
}

function resolveOpenAiTextInputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_INPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 0.15
}

function resolveOpenAiTextOutputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 0.6
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter((item): item is string => typeof item === 'string')
  return filtered.length ? filtered : undefined
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
  return filtered.length ? filtered : undefined
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asInterventionMode(value: unknown): BuildPromptInput['interventionMode'] {
  return value === 'suggestions' || value === 'feedback_analysis' ? value : undefined
}

function isInterventionMode(mode: BuildPromptInput['interventionMode']): mode is 'suggestions' | 'feedback_analysis' {
  return mode === 'suggestions' || mode === 'feedback_analysis'
}

function interventionSuggestionsSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      suggestions: {
        type: 'array',
        minItems: 3,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            objective: { type: 'string' },
            howToApply: { type: 'string' },
            whatToObserve: { type: 'string' },
            recordText: { type: 'string' },
          },
          required: ['title', 'summary', 'objective', 'howToApply', 'whatToObserve', 'recordText'],
        },
      },
    },
    required: ['suggestions'],
  }
}

function interventionFeedbackSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      analysisText: { type: 'string' },
      evolutionRecord: { type: 'string' },
      recommendedSuggestions: {
        type: 'array',
        minItems: 0,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            objective: { type: 'string' },
            howToApply: { type: 'string' },
            whatToObserve: { type: 'string' },
            recordText: { type: 'string' },
          },
          required: ['title', 'summary', 'objective', 'howToApply', 'whatToObserve', 'recordText'],
        },
      },
    },
    required: ['analysisText', 'evolutionRecord', 'recommendedSuggestions'],
  }
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
