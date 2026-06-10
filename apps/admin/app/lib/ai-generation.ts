import type { AiGenerationType } from './ai-usage'
import { createSupabaseServiceClient } from './supabase-server'
import type { BuildPromptInput } from './pedagogical-prompts'
import {
  buildStage1DraftPrompt,
  buildStage2BnccReviewPrompt,
  pipelineStagePromptVersion,
} from './pedagogical-prompts'
import {
  DOCUMENT_WORD_LIMITS,
  FORBIDDEN_PEDAGOGICAL_WORDS,
  toCanonicalDocumentGenerationType,
} from '@approf/types'

interface GeneratePedagogicalTextInput {
  ownerId: string
  generationType: AiGenerationType
  classId?: string | null
  studentId?: string | null
  promptVersion: string
  requestSummary?: Record<string, unknown>
  logId: string
  requestId?: string
}

/** Metadados de uma etapa do pipeline (persistidos em ai_generation_logs.result_summary). */
export interface PipelineStageMetadata {
  stage: 1 | 2 | 3
  etapa: 'rascunho_pedagogico' | 'revisão_bncc_segurança' | 'humanizacao_final'
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

interface TextCompletion {
  text: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostCents: number
  actualCostCents: number
}

const DEFAULT_OPENAI_INTERVENTIONS_MODEL = 'gpt-5.5'
const DEFAULT_OPENAI_DRAFT_MODEL = 'gpt-5.5'
const DEFAULT_OPENAI_REVIEW_MODEL = 'gpt-5.5'
const DEFAULT_OPENAI_HUMANIZE_MODEL = 'gpt-5.5'

interface DocumentPipelineConfig {
  stages: 1 | 2 | 3
  pipelineName: string
  draftModel: string
  reviewModel: string
}

function resolveHaikuModelId(): string {
  return process.env.OPENAI_DRAFT_MODEL?.trim()
    || process.env.OPENAI_TEXT_MODEL?.trim()
    || DEFAULT_OPENAI_DRAFT_MODEL
}

function resolveSonnetModelId(): string {
  return process.env.OPENAI_REVIEW_MODEL?.trim()
    || process.env.OPENAI_TEXT_MODEL?.trim()
    || DEFAULT_OPENAI_REVIEW_MODEL
}

function resolveDraftModelId(): string {
  const v = process.env.OPENAI_DRAFT_MODEL?.trim()
  return v || resolveHaikuModelId()
}

function resolveReviewModelId(): string {
  const v = process.env.OPENAI_REVIEW_MODEL?.trim()
  return v || resolveSonnetModelId()
}

export async function generatePedagogicalText(
  input: GeneratePedagogicalTextInput,
): Promise<GeneratePedagogicalTextResult> {
  const summary = input.requestSummary ?? {}
  const promptInput = buildPromptInputFromSummary(input, summary)
  const requestId = input.requestId ?? input.logId

  if (isInterventionMode(promptInput.interventionMode)) {
    return generateInterventionWithOpenAi(input, promptInput)
  }

  const modelDraft = resolveDraftModelId()
  const modelReview = resolveReviewModelId()
  const pipelineConfig = resolveDocumentPipelineConfig(promptInput.generationType, {
    draft: modelDraft,
    review: modelReview,
  })

  let reportId: string | null = null

  try {
    console.log('[AI-GENERATION] Pipeline iniciado:', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
      requestedGenerationType: input.generationType,
      pipeline: pipelineConfig.pipelineName,
      stages: pipelineConfig.stages,
      hasStudentId: Boolean(input.studentId),
      hasClassId: Boolean(input.classId),
    })

    const stage1Prompt = buildStage1DraftPrompt(promptInput)
    console.log('[AI-GENERATION] Etapa 1 iniciada:', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
      model: pipelineConfig.draftModel,
    })
    const s1 = await runPipelineStage(1, stage1Prompt.system, stage1Prompt.user, {
      model: pipelineConfig.draftModel,
      maxTokens: 2200,
      temperature: 0.35,
    }, { requestId, logId: input.logId, generationType: promptInput.generationType })
    console.log('[AI-GENERATION] Etapa 1 concluída:', {
      requestId,
      logId: input.logId,
      model: s1.model,
      inputTokens: s1.inputTokens,
      outputTokens: s1.outputTokens,
      estimatedCostCents: s1.estimatedCostCents,
    })

    const stage2Prompt = buildStage2BnccReviewPrompt(promptInput, s1.text)
    console.log('[AI-GENERATION] Etapa 2 iniciada:', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
      model: pipelineConfig.reviewModel,
    })
    const s2 = await runPipelineStage(2, stage2Prompt.system, stage2Prompt.user, {
      model: pipelineConfig.reviewModel,
      maxTokens: 2400,
      temperature: 0.2,
    }, { requestId, logId: input.logId, generationType: promptInput.generationType })
    console.log('[AI-GENERATION] Etapa 2 concluída:', {
      requestId,
      logId: input.logId,
      model: s2.model,
      inputTokens: s2.inputTokens,
      outputTokens: s2.outputTokens,
      estimatedCostCents: s2.estimatedCostCents,
    })

    const stage3Prompt = buildFinalHumanizationPrompt(promptInput, s2.text)
    console.log('[AI-GENERATION] Etapa 3 iniciada (humanização GPT):', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
      model: resolveOpenAiHumanizeModel(),
    })
    let s3Initial: TextCompletion
    try {
      s3Initial = await requestOpenAiHumanizationText({
        system: stage3Prompt.system,
        user: stage3Prompt.user,
        model: resolveOpenAiHumanizeModel(),
        maxTokens: 2000,
        temperature: 0.35,
      })
      console.log('[AI-GENERATION] Etapa 3 concluída (humanização GPT):', {
        requestId,
        logId: input.logId,
        model: s3Initial.model,
        inputTokens: s3Initial.inputTokens,
        outputTokens: s3Initial.outputTokens,
        estimatedCostCents: s3Initial.estimatedCostCents,
      })
    } catch (humanizeError) {
      console.warn('[AI-GENERATION] Humanização GPT indisponível; seguindo com texto revisado do Sonnet.', {
        requestId,
        logId: input.logId,
        generationType: promptInput.generationType,
        error: sanitizeInternalLogError(humanizeError),
      })
      s3Initial = {
        ...s2,
        model: `${s2.model}-humanize-fallback`,
      }
    }

    console.log('[AI-GENERATION] Validação de estrutura iniciada:', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
    })
    const structured = await ensureRequiredStructure({
      generationType: promptInput.generationType,
      reportKind: promptInput.reportKind ?? promptInput.docKind,
      candidate: s3Initial,
      model: pipelineConfig.reviewModel,
      requestId,
      logId: input.logId,
    })
    console.log('[AI-GENERATION] Validação de qualidade iniciada:', {
      requestId,
      logId: input.logId,
      generationType: promptInput.generationType,
    })
    const qualityChecked = await ensureDocumentQuality({
      generationType: promptInput.generationType,
      candidate: structured.completion,
      model: pipelineConfig.reviewModel,
      requestId,
      logId: input.logId,
    })
    const s3 = qualityChecked.completion

    const pipelineStages: PipelineStageMetadata[] = [
      toStageMeta(input.promptVersion, 1, 'rascunho_pedagogico', s1),
      toStageMeta(input.promptVersion, 2, 'revisão_bncc_segurança', s2),
      toStageMeta(input.promptVersion, 3, 'humanizacao_final', s3),
    ]

    const inputTokens = s1.inputTokens + s2.inputTokens + s3.inputTokens
    const outputTokens = s1.outputTokens + s2.outputTokens + s3.outputTokens
    const actualCostCents = s1.actualCostCents + s2.actualCostCents + s3.actualCostCents

    console.log('[AI-GENERATION] Persistência do relatório iniciada:', {
      requestId,
      logId: input.logId,
      generationType: input.generationType,
    })
    const cleanText = cleanupGeneratedText(s3.text)
    reportId = await persistGeneratedReport(input, cleanText)
    if (!reportId) {
      throw new PublicAiGenerationError('Não foi possivel salvar o relatório gerado. Tente novamente.')
    }
    console.log('[AI-GENERATION] Relatório persistido:', {
      requestId,
      logId: input.logId,
      reportId,
      generationType: input.generationType,
    })

    console.log('[AI-GENERATION] Persistência de uso iniciada:', {
      requestId,
      logId: input.logId,
      reportId,
    })
    await persistUsage(
      reportId,
      input.ownerId,
      'openai',
      `gpt:${s1.model}|${s2.model}|${s3.model}`,
      inputTokens,
      outputTokens,
      actualCostCents,
    )
    console.log('[AI-GENERATION] Uso persistido:', {
      requestId,
      logId: input.logId,
      reportId,
      inputTokens,
      outputTokens,
      actualCostCents,
    })

    return {
      text: cleanText,
      provider: 'openai',
      model: s3.model,
      pipeline: 'gpt-document-pipeline',
      promptVersion: input.promptVersion,
      inputTokens,
      outputTokens,
      actualCostCents,
      reportId,
      pipelineStages,
    }
  } catch (error) {
    console.error('[AI-GENERATION] Pipeline falhou:', {
      requestId,
      logId: input.logId,
      reportId,
      generationType: input.generationType,
      error: sanitizeInternalLogError(error),
    })
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

  const cleanText = openAi.text.trim()
  const reportId = await persistGeneratedReport(input, cleanText)
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
    text: cleanText,
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
  candidate: TextCompletion
  model: string
  requestId: string
  logId: string
}) {
  const validation = validateRequiredStructure(input.generationType, input.reportKind, input.candidate.text)
  if (validation.ok) {
    console.log('[AI-GENERATION] Estrutura aprovada:', {
      requestId: input.requestId,
      logId: input.logId,
      generationType: input.generationType,
    })
    return { completion: input.candidate }
  }

  console.warn('[AI-GENERATION] Estrutura precisa de reparo:', {
    requestId: input.requestId,
    logId: input.logId,
    generationType: input.generationType,
    missing: validation.missing,
  })

  const repair = await requestOpenAiHumanizationText({
    system: buildStructureRepairSystemPrompt(input.generationType),
    user: [
      'DOCUMENTO ATUAL:',
      input.candidate.text.trim(),
      '',
      'SECOES OBRIGATORIAS AUSENTES OU INSUFICIENTES:',
      ...validation.missing.map((item) => `- ${item}`),
      '',
      'INSTRUCAO:',
      'Reorganize o texto e garanta que todas as secoes exigidas aparecam com títulos claros.',
    ].join('\n'),
    model: input.model,
    maxTokens: 2200,
    temperature: 0.25,
  })

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
      '[AI-GENERATION] Estrutura ainda incompleta após reparo',
      {
        requestId: input.requestId,
        logId: input.logId,
        generationType: input.generationType,
        missing: repairedValidation.missing,
      },
    )
  } else {
    console.log('[AI-GENERATION] Estrutura reparada:', {
      requestId: input.requestId,
      logId: input.logId,
      generationType: input.generationType,
    })
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
      'Você revisa planejamentos de reunião de pais.',
      'Inclua seções claras: Abertura, Pauta, Informações gerais da turma, Combinados, Espaço para anotações e Encerramento.',
      'Não cite nomes de crianças; fale da turma como grupo.',
      'Retorne APENAS o documento final.',
    ].join('\n')
  }

  if (generationType === 'specialist_referral' || generationType === 'specialist_report') {
    return [
      'Você revisa encaminhamentos para especialistas.',
      'Use apenas fatos observáveis, estrategias já aplicadas e solicitação final, sem diagnóstico.',
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
  candidate: TextCompletion
  model: string
  requestId: string
  logId: string
}) {
  const validation = validateDocumentQuality(input.generationType, input.candidate.text)
  if (validation.ok) {
    console.log('[AI-GENERATION] Qualidade aprovada:', {
      requestId: input.requestId,
      logId: input.logId,
      generationType: input.generationType,
    })
    return { completion: input.candidate }
  }

  console.warn('[AI-GENERATION] Qualidade precisa de reparo:', {
    requestId: input.requestId,
    logId: input.logId,
    generationType: input.generationType,
    issueCount: validation.issues.length,
    issues: validation.issues,
  })

  const repair = await requestOpenAiHumanizationText({
    system: [
      'Você é revisor final de documentos pedagógicos da Educação Infantil.',
      'Ajuste o texto para cumprir regras de tamanho, linguagem natural e segurança pedagógica.',
      'Preserve todas as informações relevantes da professora e não invente fatos.',
      'Retorne APENAS o documento final corrigido.',
    ].join('\n'),
    user: [
      'DOCUMENTO ATUAL:',
      input.candidate.text.trim(),
      '',
      'AJUSTES OBRIGATORIOS:',
      ...validation.issues.map((item) => `- ${item}`),
    ].join('\n'),
    model: input.model,
    maxTokens: 2000,
    temperature: 0.25,
  })

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
      !hasAnyHeading(text, ['tema', 'título']) && 'Tema/Título',
      !hasAnyHeading(text, ['objetivo']) && 'Objetivo',
      !hasAnyHeading(text, ['atividade', 'desenvolvimento', 'passo a passo']) && 'Atividade/Desenvolvimento',
      !hasAnyHeading(text, ['materiais']) && 'Materiais necessarios',
      !hasAnyHeading(text, ['duracao', 'tempo estimado']) && 'Duracao/Tempo estimado',
      !hasAnyHeading(text, ['observações', 'avaliação']) && 'Observações/Avaliação',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'pedagogical_project') {
    const missing = [
      !hasAnyHeading(text, ['justificativa']) && 'Justificativa',
      !hasAnyHeading(text, ['objetivo']) && 'Objetivos',
      !hasAnyHeading(text, ['etapas', 'desenvolvimento']) && 'Etapas/Desenvolvimento',
      !hasAnyHeading(text, ['avaliação', 'acompanhamento']) && 'Avaliação/Acompanhamento',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'parents_meeting_record') {
    const missing = [
      !hasAnyHeading(text, ['abertura']) && 'Abertura',
      !hasAnyHeading(text, ['pauta']) && 'Pauta',
      !hasAnyHeading(text, ['informações gerais', 'informações gerais', 'turma']) && 'Informações gerais da turma',
      !hasAnyHeading(text, ['combinados']) && 'Combinados',
      !hasAnyHeading(text, ['anotações', 'anotações']) && 'Espaço para anotações',
      !hasAnyHeading(text, ['encerramento']) && 'Encerramento',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  if (generationType === 'specialist_referral' || generationType === 'specialist_report') {
    const missing = [
      !hasAnyHeading(text, ['motivo', 'encaminhamento']) && 'Motivo do encaminhamento',
      !hasAnyHeading(text, ['observações', 'comportamentos']) && 'Observações/Comportamentos observáveis',
      !hasAnyHeading(text, ['estrategias', 'apoio']) && 'Estrategias já aplicadas',
      !hasAnyHeading(text, ['encaminhamentos finais', 'solicitação']) && 'Encaminhamento final',
    ].filter(Boolean) as string[]
    return { ok: missing.length === 0, missing }
  }

  const isDevelopmentLike = generationType === 'development_report'
    || generationType === 'general_report'
    || normalize(reportKind ?? '').includes('desenvolvimento')

  if (isDevelopmentLike) {
    const missing = [
      !hasAnyHeading(text, ['informações basicas', 'identificacao']) && 'Informações basicas',
      !hasAnyHeading(text, ['adaptacao', 'convivencia']) && 'Adaptação e convivência',
      !hasAnyHeading(text, ['linguagem']) && 'Desenvolvimento da linguagem',
      !hasAnyHeading(text, ['motor']) && 'Desenvolvimento motor',
      !hasAnyHeading(text, ['cognitivo', 'autonomia']) && 'Desenvolvimento cognitivo e autonomia',
      !hasAnyHeading(text, ['interesses', 'preferencias']) && 'Interesses e preferências',
      !hasAnyHeading(text, ['familia']) && 'Participação da família',
      !hasAnyHeading(text, ['considerações finais', 'consideracoes finais']) && 'Considerações finais',
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
    'diagnóstico',
    'transtorno',
    'deficit',
    'laudo',
    'tdah',
    'tea',
    'suspeita de',
    'incapaz',
    'problema de comportamento',
    ...FORBIDDEN_PEDAGOGICAL_WORDS,
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
    issues.push('Reduzir o encaminhamento para especialista, mantendo apenas fatos observáveis, estrategias e solicitação.')
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

  if (generationType === 'development_report' && normalized.includes('campo de experiencia')) {
    issues.push('Remover seção de campos de experiência; relatório deve usar adaptação, linguagem, motor, cognitivo/autonomia, interesses, família e considerações finais.')
  }

  if (generationType === 'pedagogical_project' && words > 1100) {
    issues.push('Reduzir o projeto pedagógico para estrutura objetiva, sem texto acadêmico extenso.')
  }

  const canonicalType = toCanonicalDocumentGenerationType(generationType)
  const wordLimit = canonicalType ? DOCUMENT_WORD_LIMITS[canonicalType] : 0
  if (wordLimit > 0 && words > Math.ceil(wordLimit * 1.25)) {
    issues.push(`Reduzir o documento para mais perto de ${wordLimit} palavras, preservando os detalhes importantes.`)
  }

  return { ok: issues.length === 0, issues }
}

function resolveDocumentPipelineConfig(
  _generationType: AiGenerationType,
  models: { draft: string; review: string },
): DocumentPipelineConfig {
  return {
    stages: 3,
    pipelineName: 'gpt-document-pipeline',
    draftModel: models.draft,
    reviewModel: models.review,
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

function cleanupGeneratedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')              // ## Títulos
    .replace(/\*\*(.*?)\*\*/g, '$1')          // **negrito**
    .replace(/__(.*?)__/g, '$1')              // __negrito__
    .replace(/\*(.*?)\*/g, '$1')              // *itálico*
    .replace(/_(.*?)_/g, '$1')               // _itálico_
    .replace(/`{3}[\s\S]*?`{3}/g, '')        // ```bloco de código```
    .replace(/`([^`]+)`/g, '$1')             // `código inline`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url)
    .replace(/^[-*+]\s+/gm, '')              // - listas com traço/asterisco
    .replace(/^\d+\.\s+/gm, '')              // 1. listas numeradas
    .replace(/^-{3,}$/gm, '')                // --- separadores
    .replace(/^={3,}$/gm, '')                // === separadores
    .replace(/[{}[\]]/g, '')
    .replace(/"{2,}/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toStageMeta(
  basePromptVersion: string,
  stage: 1 | 2 | 3,
  etapa: PipelineStageMetadata['etapa'],
  completion: TextCompletion,
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
  logContext?: { requestId: string; logId: string; generationType: AiGenerationType },
) {
  try {
    return await requestOpenAiHumanizationText({ system, user, ...opts })
  } catch (error) {
    console.error(`[AI-GENERATION] Falha na etapa ${stageNumber} do pipeline GPT`, {
      ...logContext,
      stage: stageNumber,
      model: opts.model,
      error: sanitizeInternalLogError(error),
    })
    throw error
  }
}

export async function rollbackGeneratedArtifacts(input: { reportId: string; ownerId: string }) {
  await deleteReportUsage(input.reportId, input.ownerId)
  await deleteReport(input.reportId, input.ownerId)
}

interface RequestOpenAiInterventionOptions {
  mode: 'suggestions' | 'feedback_analysis'
  system: string
  user: string
  model: string
}

interface RequestOpenAiHumanizationOptions {
  system: string
  user: string
  model: string
  maxTokens?: number
  temperature?: number
}

function sanitizeInternalLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    }
  }

  return { message: String(error) }
}

async function requestOpenAiInterventionText(options: RequestOpenAiInterventionOptions) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Serviço de IA indisponível no momento. Tente novamente em instantes.')
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
    throw new PublicAiGenerationError('A IA não retornou conteúdo suficiente para intervenções.')
  }

  const inputTokens = payload?.usage?.prompt_tokens ?? 0
  const outputTokens = payload?.usage?.completion_tokens ?? 0
  return {
    text,
    provider: 'openai',
    model: payload?.model ?? options.model,
    inputTokens,
    outputTokens,
    estimatedCostCents: estimateOpenAiInterventionCostCents(inputTokens, outputTokens),
    actualCostCents: estimateOpenAiInterventionCostCents(inputTokens, outputTokens),
  }
}

async function requestOpenAiHumanizationText(options: RequestOpenAiHumanizationOptions) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Serviço de IA indisponível no momento. Tente novamente em instantes.')
  }

  const requestPayload: {
    model: string
    max_completion_tokens: number
    messages: Array<{ role: 'system' | 'user'; content: string }>
    temperature?: number
  } = {
    model: options.model,
    max_completion_tokens: options.maxTokens ?? 1800,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
  }
  const normalizedModel = options.model.toLowerCase()
  if (!normalizedModel.startsWith('gpt-5')) {
    requestPayload.temperature = options.temperature ?? 0.35
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  })

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    error?: { message?: string }
    model?: string
  } | null

  if (!response.ok) {
    console.error('[ai-generation] OpenAI HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Não foi possivel humanizar o texto agora. Tente novamente em instantes.')
  }

  const text = payload?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new PublicAiGenerationError('A IA não retornou conteúdo suficiente para humanização final.')
  }

  const inputTokens = payload?.usage?.prompt_tokens ?? 0
  const outputTokens = payload?.usage?.completion_tokens ?? 0
  const estimatedCostCents = estimateOpenAiHumanizeCostCents(inputTokens, outputTokens)
  return {
    text,
    provider: 'openai',
    model: payload?.model ?? options.model,
    inputTokens,
    outputTokens,
    estimatedCostCents,
    actualCostCents: estimatedCostCents,
  } satisfies TextCompletion
}

function buildFinalHumanizationPrompt(input: BuildPromptInput, reviewedText: string) {
  const kind = input.reportKind || input.docKind || input.generationType
  const wordCount = reviewedText.trim().split(/\s+/).filter(Boolean).length
  return {
    system: [
      'Você é uma professora experiente da educação infantil revisando um documento pedagógico já estruturado.',
      'Sua função NÁO é reescrever completamente o texto.',
      'Sua função é humanizar, simplificar, melhorar fluidez, deixar mais natural, acolhedor e objetivo.',
      'Preserve acontecimentos reais, nomes importantes e observações da professora.',
      'Reduza tom acadêmico, formalidade excessiva, frases robóticas e floreios desnecessários.',
      'Não invente informações, não remova fatos relevantes e não adicione BNCC sem necessidade.',
      'Mantenha a estrutura geral e os títulos do documento sempre que possível.',
      'Se o texto já estiver enxuto, mantenhá tamanho parecido ou levemente menor.',
      'Entregue APENAS o texto final humanizado, sem comentários meta.',
    ].join('\n'),
    user: [
      `TIPO DE DOCUMENTO: ${kind}`,
      `TAMANHO DE REFERÊNCIA: ${wordCount} palavras`,
      '',
      'TEXTO REVISADO (base obrigatória):',
      reviewedText.trim(),
      '',
      'AJUSTES OBRIGATÓRIOS:',
      '- Preserve fatos, nomes e observações reais.',
      '- Melhore naturalidade, clareza e acolhimento.',
      '- Reduza excesso acadêmico e termos artificiais.',
      '- Não aumente significativamente o tamanho do texto.',
    ].join('\n'),
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
    unifiedCreator: asBoolean(summary.unifiedCreator),
    documentTitle: asString(summary.documentTitle),
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
    planningPeriod: asString(summary.planningPeriod),
    intentionality: asStringArray(summary.intentionality) ?? asStringArray(summary.direitosAprendizagem),
    resources: asString(summary.resources),
    duration: asString(summary.duration),
    justification: asString(summary.justification),
    methodology: asString(summary.methodology),
    assessment: asStringArray(summary.assessment) ?? asStringArray(summary.avaliaçãoRegistro),
    finalConsiderations: asString(summary.finalConsiderations),
    selectedMilestones: asObjectArray(summary.selectedMilestones) as BuildPromptInput['selectedMilestones'],
    includeDayAnnotations: asBoolean(summary.includeDayAnnotations),
    meetingDate: asString(summary.meetingDate),
    meetingDuration: asString(summary.meetingDuration),
    meetingAgenda: asString(summary.meetingAgenda),
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

  if (generationType === 'classroom_journal') return 'class_diary'
  if (generationType === 'planning_daily') return 'daily_lesson_plan'
  if (generationType === 'planning_weekly') return 'weekly_planning'
  if (generationType === 'planning_project') return 'pedagogical_project'
  if (generationType === 'planning_meeting') return 'parents_meeting_record'
  if (generationType === 'parents_meeting') return 'parents_meeting_record'

  if (generationType === 'planning') {
    if (normalizedDocKind.includes('plano de aula')) return 'daily_lesson_plan'
    if (normalizedDocKind.includes('projeto pedagogico')) return 'pedagogical_project'
    return 'weekly_planning'
  }

  if (generationType === 'specialist_report') return 'specialist_referral'
  if (generationType === 'general_report') {
    if (normalizedReportKind.includes('diario de bordo')) return 'class_diary'
    if (normalizedReportKind.includes('reunião de pais')) return 'parents_meeting_record'
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
      coordinator_review_status: input.generationType === 'development_report' ? 'pending' : 'not_required',
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

function estimateOpenAiInterventionCostCents(inputTokens: number, outputTokens: number) {
  const inputUsdPerMillion = resolveOpenAiTextInputUsdPerMillion()
  const outputUsdPerMillion = resolveOpenAiTextOutputUsdPerMillion()
  const usd = (inputTokens / 1_000_000) * inputUsdPerMillion + (outputTokens / 1_000_000) * outputUsdPerMillion
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(0, Math.round(brlApprox * 100))
}

function estimateOpenAiHumanizeCostCents(inputTokens: number, outputTokens: number) {
  const inputUsdPerMillion = resolveOpenAiHumanizeInputUsdPerMillion()
  const outputUsdPerMillion = resolveOpenAiHumanizeOutputUsdPerMillion()
  const usd = (inputTokens / 1_000_000) * inputUsdPerMillion + (outputTokens / 1_000_000) * outputUsdPerMillion
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(0, Math.round(brlApprox * 100))
}

function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

function resolveOpenAiInterventionsModel() {
  const fromEnv = process.env.OPENAI_INTERVENTIONS_MODEL?.trim()
    || process.env.OPENAI_INTERVIEWER_MODEL?.trim()
  return fromEnv || DEFAULT_OPENAI_INTERVENTIONS_MODEL
}

function resolveOpenAiHumanizeModel() {
  const fromEnv = process.env.OPENAI_HUMANIZE_MODEL?.trim()
    || process.env.OPENAI_ANSWER_MODEL?.trim()
  return fromEnv || DEFAULT_OPENAI_HUMANIZE_MODEL
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

function resolveOpenAiHumanizeInputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_HUMANIZE_INPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return resolveOpenAiTextInputUsdPerMillion()
}

function resolveOpenAiHumanizeOutputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_HUMANIZE_OUTPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return resolveOpenAiTextOutputUsdPerMillion()
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
