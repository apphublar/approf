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
  /** Custo estimado a partir dos tokens (API não retorna USD direto). */
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
const HAIKU_MODEL = 'claude-3-5-haiku-20241022'

interface DocumentPipelineConfig {
  stages: 1 | 2 | 3
  pipelineName: string
  draftModel: string
  reviewModel: string
  refineModel?: string
}

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
  const pipelineConfig = resolveDocumentPipelineConfig(promptInput.generationType, {
    draft: modelDraft,
    review: modelReview,
    refine: modelRefine,
  })

  let reportId: string | null = null

  try {
    const stage1Prompt = buildStage1DraftPrompt(promptInput)
    const s1 = await runPipelineStage(1, stage1Prompt.system, stage1Prompt.user, {
      model: pipelineConfig.draftModel,
      maxTokens: 2200,
      temperature: 0.35,
    })

    const stage2Prompt = buildStage2BnccReviewPrompt(promptInput, s1.text)
    const s2 = await runPipelineStage(2, stage2Prompt.system, stage2Prompt.user, {
      model: pipelineConfig.reviewModel,
      maxTokens: 2400,
      temperature: 0.2,
    })

    const stage3Prompt = pipelineConfig.stages === 3
      ? buildStage3FinalRefinementPrompt(promptInput, s2.text)
      : null
    const s3Initial = pipelineConfig.stages === 3
      ? await runPipelineStage(3, stage3Prompt!.system, stage3Prompt!.user, {
          model: pipelineConfig.refineModel ?? pipelineConfig.reviewModel,
          maxTokens: 2000,
          temperature: 0.45,
        })
      : s2
    const structured = await ensureRequiredStructure({
      generationType: promptInput.generationType,
      reportKind: promptInput.reportKind ?? promptInput.docKind,
      candidate: s3Initial,
      model: pipelineConfig.refineModel ?? pipelineConfig.reviewModel,
    })
    const qualityChecked = await ensureDocumentQuality({
      generationType: promptInput.generationType,
      candidate: structured.completion,
      model: pipelineConfig.refineModel ?? pipelineConfig.reviewModel,
    })
    const s3 = qualityChecked.completion

    const pipelineStages: PipelineStageMetadata[] = pipelineConfig.stages === 3
      ? [
          toStageMeta(input.promptVersion, 1, 'rascunho_pedagogico', s1),
          toStageMeta(input.promptVersion, 2, 'revisao_bncc_seguranca', s2),
          toStageMeta(input.promptVersion, 3, 'refinamento_final', s3),
        ]
      : [
          toStageMeta(input.promptVersion, 1, 'rascunho_pedagogico', s1),
          toStageMeta(input.promptVersion, 2, 'revisao_bncc_seguranca', s3),
        ]

    const inputTokens = pipelineConfig.stages === 3
      ? s1.inputTokens + s2.inputTokens + s3.inputTokens
      : s1.inputTokens + s3.inputTokens
    const outputTokens = pipelineConfig.stages === 3
      ? s1.outputTokens + s2.outputTokens + s3.outputTokens
      : s1.outputTokens + s3.outputTokens
    const actualCostCents = pipelineConfig.stages === 3
      ? s1.actualCostCents + s2.actualCostCents + s3.actualCostCents
      : s1.actualCostCents + s3.actualCostCents

    reportId = await persistGeneratedReport(input, s3.text)
    if (!reportId) {
      throw new PublicAiGenerationError('Não foi possivel salvar o relatório gerado. Tente novamente.')
    }

    await persistUsage(
      reportId,
      input.ownerId,
      'anthropic',
      pipelineConfig.stages === 3
        ? `3stage:${s1.model}|${s2.model}|${s3.model}`
        : `2stage:${s1.model}|${s3.model}`,
      inputTokens,
      outputTokens,
      actualCostCents,
    )

    return {
      text: s3.text,
      provider: 'anthropic',
      model: s3.model,
      pipeline: pipelineConfig.pipelineName,
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
    buildStructureRepairSystemPrompt(input.generationType),
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
    console.warn(
      '[ai-generation] estrutura ainda incompleta apos reparo',
      input.generationType,
      repairedValidation.missing,
    )
  }

  return { completion: merged }
}

function buildStructureRepairSystemPrompt(generationType: AiGenerationType) {
  if (generationType === 'class_diary') {
    return [
      'Você revisa diários de bordo da Educação Infantil.',
      'Garanta registro natural da rotina em 1 a 3 parágrafos curtos, sem BNCC explícita e sem diagnóstico.',
      'Retorne APENAS o texto final.',
    ].join('\n')
  }

  if (generationType === 'parents_meeting_record') {
    return [
      'Você revisa atas de reunião de pais.',
      'Inclua seções claras: Pauta, Combinados e Encaminhamentos, sem inventar fatos.',
      'Retorne APENAS o documento final.',
    ].join('\n')
  }

  if (generationType === 'specialist_referral' || generationType === 'specialist_report') {
    return [
      'Você revisa encaminhamentos para especialistas.',
      'Use apenas fatos observáveis, estratégias já aplicadas e solicitação final, sem diagnóstico.',
      'Retorne APENAS o documento final.',
    ].join('\n')
  }

  if (generationType === 'weekly_planning' || generationType === 'daily_lesson_plan' || generationType === 'planning' || generationType === 'pedagogical_project') {
    return [
      'Você revisa planejamentos pedagógicos práticos para Educação Infantil.',
      'Organize o texto com títulos claros para cada seção obrigatória, sem texto acadêmico longo.',
      'Retorne APENAS o documento final completo.',
    ].join('\n')
  }

  return [
    'Você revisa documentos pedagógicos da Educação Infantil.',
    'Reescreva para cumprir as seções obrigatórias, sem inventar fatos novos.',
    'Mantenha linguagem acolhedora, sem comparação entre crianças e sem diagnóstico clínico.',
    'Retorne APENAS o documento final completo.',
  ].join('\n')
}

async function ensureDocumentQuality(input: {
  generationType: AiGenerationType
  candidate: Awaited<ReturnType<typeof requestClaudeText>>
  model: string
}) {
  const validation = validateDocumentQuality(input.generationType, input.candidate.text)
  if (validation.ok) {
    return { completion: input.candidate }
  }

  const repair = await requestClaudeText(
    [
      'Você é revisor final de documentos pedagógicos da Educação Infantil.',
      'Ajuste o texto para cumprir regras de tamanho, linguagem natural e segurança pedagógica.',
      'Preserve todas as informações relevantes da professora e não invente fatos.',
      'Retorne APENAS o documento final corrigido.',
    ].join('\n'),
    [
      'DOCUMENTO ATUAL:',
      input.candidate.text.trim(),
      '',
      'AJUSTES OBRIGATORIOS:',
      ...validation.issues.map((item) => `- ${item}`),
    ].join('\n'),
    {
      model: input.model,
      maxTokens: 2000,
      temperature: 0.25,
    },
  )

  return {
    completion: {
      ...repair,
      inputTokens: input.candidate.inputTokens + repair.inputTokens,
      outputTokens: input.candidate.outputTokens + repair.outputTokens,
      estimatedCostCents: input.candidate.estimatedCostCents + repair.estimatedCostCents,
      actualCostCents: input.candidate.actualCostCents + repair.actualCostCents,
    },
  }
}

function validateRequiredStructure(generationType: AiGenerationType, reportKind: string | undefined, text: string) {
  if (generationType === 'weekly_planning' || generationType === 'daily_lesson_plan' || generationType === 'planning') {
    const missing = [
      !hasAnyHeading(text, ['tema', 'titulo']) && 'Tema/Titulo',
      !hasAnyHeading(text, ['objetivo']) && 'Objetivo',
      !hasAnyHeading(text, ['atividade', 'desenvolvimento', 'passo a passo']) && 'Atividade/Desenvolvimento',
      !hasAnyHeading(text, ['materiais']) && 'Materiais necessarios',
      !hasAnyHeading(text, ['duracao', 'tempo estimado']) && 'Duracao/Tempo estimado',
      !hasAnyHeading(text, ['observacoes', 'avaliação']) && 'Observacoes/Avaliação',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'pedagogical_project') {
    const missing = [
      !hasAnyHeading(text, ['justificativa']) && 'Justificativa',
      !hasAnyHeading(text, ['objetivo']) && 'Objetivos',
      !hasAnyHeading(text, ['etapas', 'desenvolvimento']) && 'Etapas/Desenvolvimento',
      !hasAnyHeading(text, ['avaliacao', 'acompanhamento']) && 'Avaliação/Acompanhamento',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'parents_meeting_record') {
    const missing = [
      !hasAnyHeading(text, ['pauta']) && 'Pauta',
      !hasAnyHeading(text, ['combinados']) && 'Combinados',
      !hasAnyHeading(text, ['encaminhamentos']) && 'Encaminhamentos',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'specialist_referral' || generationType === 'specialist_report') {
    const missing = [
      !hasAnyHeading(text, ['motivo', 'encaminhamento']) && 'Motivo do encaminhamento',
      !hasAnyHeading(text, ['observacoes', 'comportamentos']) && 'Observações/Comportamentos observáveis',
      !hasAnyHeading(text, ['estrategias', 'apoio']) && 'Estratégias já aplicadas',
      !hasAnyHeading(text, ['encaminhamentos finais', 'solicitacao']) && 'Encaminhamento final',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  const isDevelopmentLike = generationType === 'development_report'
    || generationType === 'general_report'
    || normalize(reportKind ?? '').includes('desenvolvimento')

  if (isDevelopmentLike) {
    const missing = [
      !hasAnyHeading(text, ['informações basicas', 'identificacao']) && 'Informações basicas',
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

function validateDocumentQuality(generationType: AiGenerationType, text: string) {
  const issues: string[] = []
  const normalized = normalize(text)
  const words = text.trim().split(/\s+/).filter(Boolean).length

  const forbidden = [
    'diagnostico',
    'transtorno',
    'deficit',
    'laudo',
    'tdah',
    'tea',
    'suspeita de',
    'incapaz',
    'problema de comportamento',
  ]
  const forbiddenMatches = forbidden.filter((term) => normalized.includes(term))
  if (forbiddenMatches.length) {
    issues.push(`Remover linguagem clínica ou julgadora: ${forbiddenMatches.join(', ')}.`)
  }

  if (generationType === 'class_diary') {
    if (words > 230) issues.push('Reduzir o diário para 1 a 3 parágrafos curtos.')
    if (normalized.includes('bncc') || normalized.includes('campo de experiencia')) {
      issues.push('Remover menções diretas à BNCC; diário de bordo deve ser registro natural da rotina.')
    }
  }

  if (generationType === 'parents_meeting_record' && words > 450) {
    issues.push('Reduzir o registro de reunião para uma ata simples e objetiva.')
  }

  if ((generationType === 'specialist_referral' || generationType === 'specialist_report') && words > 650) {
    issues.push('Reduzir o encaminhamento para especialista, mantendo apenas fatos observáveis, estratégias e solicitação.')
  }

  if (generationType === 'daily_lesson_plan' && words > 700) {
    issues.push('Reduzir o plano de aula diário para formato operacional e escaneável.')
  }

  if (generationType === 'weekly_planning' && words > 950) {
    issues.push('Reduzir o planejamento semanal, mantendo organização por dias/blocos e itens aplicáveis.')
  }

  if (generationType === 'development_report' && words > 900) {
    issues.push('Reduzir o relatório de desenvolvimento para tamanho médio, preservando avanços e pontos de continuidade.')
  }

  if (generationType === 'pedagogical_project' && words > 1100) {
    issues.push('Reduzir o projeto pedagógico para estrutura objetiva, sem texto acadêmico extenso.')
  }

  return { ok: issues.length === 0, issues }
}

function resolveDocumentPipelineConfig(
  generationType: AiGenerationType,
  models: { draft: string; review: string; refine: string },
): DocumentPipelineConfig {
  if (generationType === 'class_diary' || generationType === 'parents_meeting_record' || generationType === 'specialist_referral' || generationType === 'specialist_report' || generationType === 'daily_lesson_plan') {
    return {
      stages: 2,
      pipelineName: 'claude-text-2-stage',
      draftModel: HAIKU_MODEL,
      reviewModel: models.refine,
    }
  }

  if (generationType === 'weekly_planning' || generationType === 'pedagogical_project' || generationType === 'development_report' || generationType === 'portfolio_text') {
    return {
      stages: 3,
      pipelineName: 'claude-text-3-stage',
      draftModel: HAIKU_MODEL,
      reviewModel: models.review,
      refineModel: models.refine,
    }
  }

  return {
    stages: 3,
    pipelineName: 'claude-text-3-stage',
    draftModel: models.draft,
    reviewModel: models.review,
    refineModel: models.refine,
  }
}

function hasAnyHeading(text: string, candidates: string[]) {
  const normalizedBody = normalize(text)
  return candidates.some((candidate) => normalizedBody.includes(normalize(candidate)))
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
    throw new PublicAiGenerationError('Não foi possivel gerar o texto agora. Tente novamente em instantes.')
  }

  const text = payload?.content
    ?.filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text ?? '')
    .join('\n')
    .trim()

  if (!text) {
    throw new PublicAiGenerationError('A IA não retornou conteudo suficiente. Ajuste o contexto e tente novamente.')
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
    throw new PublicAiGenerationError('Não foi possivel gerar sugestões agora. Tente novamente em instantes.')
  }

  const text = payload?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new PublicAiGenerationError('A IA não retornou conteudo suficiente para intervenções.')
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
  const resolvedGenerationType = resolveLegacyGenerationType(
    input.generationType,
    asString(summary.reportKind),
    asString(summary.docKind),
  )
  return {
    generationType: resolvedGenerationType,
    promptVersion: input.promptVersion,
    reportKind: asString(summary.reportKind),
    docKind: asString(summary.docKind),
    studentName: asString(summary.studentName),
    className: asString(summary.className),
    ageGroup: asString(summary.ageGroup),
    evaluationPeriod: asString(summary.evaluationPeriod),
    mode: asString(summary.mode),
    historyScope: asHistoryScope(summary.historyScope),
    selectedAnnotations: asObjectArray(summary.selectedAnnotations) as BuildPromptInput['selectedAnnotations'],
    ignoredNotes: asString(summary.ignoredNotes),
    blankContext: asString(summary.blankContext),
    extraContext: asString(summary.extraContext),
    objective: asString(summary.objective),
    theme: asString(summary.theme),
    diaryDate: asString(summary.diaryDate),
    diaryTheme: asString(summary.diaryTheme),
    diaryRawText: asString(summary.diaryRawText),
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

function resolveLegacyGenerationType(
  generationType: AiGenerationType,
  reportKind?: string,
  docKind?: string,
): AiGenerationType {
  const normalizedReportKind = normalize(reportKind ?? '')
  const normalizedDocKind = normalize(docKind ?? '')

  if (generationType === 'planning') {
    if (normalizedDocKind.includes('plano de aula')) return 'daily_lesson_plan'
    if (normalizedDocKind.includes('projeto pedagogico')) return 'pedagogical_project'
    return 'weekly_planning'
  }

  if (generationType === 'specialist_report') return 'specialist_referral'
  if (generationType === 'general_report') {
    if (normalizedReportKind.includes('diario de bordo')) return 'class_diary'
    if (normalizedReportKind.includes('reuniao de pais')) return 'parents_meeting_record'
    if (normalizedReportKind.includes('especialista') || normalizedReportKind.includes('encaminhamento')) return 'specialist_referral'
  }

  return generationType
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
    throw new PublicAiGenerationError('Não foi possivel salvar o relatório gerado. Tente novamente.')
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

  if (error) throw toError(error, 'Não foi possivel registrar consumo do relatório.')
}

async function deleteReportUsage(reportId: string, ownerId: string) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('reports_usage')
    .delete()
    .eq('report_id', reportId)
    .eq('owner_id', ownerId)

  if (error) {
    throw toError(error, 'Não foi possivel limpar uso parcial do relatório.')
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
    throw toError(error, 'Não foi possivel limpar relatório parcial apos falha.')
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

function asHistoryScope(value: unknown): BuildPromptInput['historyScope'] {
  return value === 'model' || value === 'student' ? value : undefined
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

