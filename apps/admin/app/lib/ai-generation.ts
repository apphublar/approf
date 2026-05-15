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
  promptVersion: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
  reportId: string
  pipelineStages: PipelineStageMetadata[]
}

export class PublicAiGenerationError extends Error {}

export async function generatePedagogicalText(
  input: GeneratePedagogicalTextInput,
): Promise<GeneratePedagogicalTextResult> {
  const summary = input.requestSummary ?? {}
  const promptInput = buildPromptInputFromSummary(input, summary)

  let reportId: string | null = null

  try {
    const stage1Prompt = buildStage1DraftPrompt(promptInput)
    const s1 = await runPipelineStage(1, stage1Prompt.system, stage1Prompt.user, {
      maxTokens: 2200,
      temperature: 0.35,
    })

    const stage2Prompt = buildStage2BnccReviewPrompt(promptInput, s1.text)
    const s2 = await runPipelineStage(2, stage2Prompt.system, stage2Prompt.user, {
      maxTokens: 2400,
      temperature: 0.2,
    })

    const stage3Prompt = buildStage3FinalRefinementPrompt(promptInput, s2.text)
    const s3 = await runPipelineStage(3, stage3Prompt.system, stage3Prompt.user, {
      maxTokens: 2000,
      temperature: 0.45,
    })

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
      `${s3.model}+3stage`,
      inputTokens,
      outputTokens,
      actualCostCents,
    )

    return {
      text: s3.text,
      provider: 'anthropic',
      model: s3.model,
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
  opts: { maxTokens: number; temperature: number },
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
  maxTokens?: number
  temperature?: number
}

async function requestClaudeText(system: string, user: string, options?: RequestClaudeOptions) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de IA indisponivel no momento. Tente novamente em instantes.')
  }

  const model = process.env.ANTHROPIC_TEXT_MODEL || 'claude-sonnet-4-20250514'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 1800,
      temperature: options?.temperature ?? 0.4,
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
  const isSonnet = model.toLowerCase().includes('sonnet')
  const inputCostPerMillion = isSonnet ? 3 : 3
  const outputCostPerMillion = isSonnet ? 15 : 15
  const usd = (inputTokens / 1_000_000) * inputCostPerMillion + (outputTokens / 1_000_000) * outputCostPerMillion
  const brlApprox = usd * 5.5
  return Math.max(1, Math.round(brlApprox * 100))
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

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
