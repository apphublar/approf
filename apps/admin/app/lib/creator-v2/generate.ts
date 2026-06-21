import type { CreatorNoteRef, CreatorPayload } from '@approf/types'
import {
  DEFAULT_OPENAI_TEXT_MODEL,
  resolveOpenAiModel,
  withOpenAiTemperature,
} from '../openai-models'
import { estimateOpenAiTextCostCents } from '../openai-cost'
import { stripMarkdownFromPedagogicalText } from '../pedagogical-text-format'
import { PublicAiGenerationError } from '../ai-generation'
import type { AiGenerationType } from '../ai-usage'
import { createSupabaseServiceClient } from '../supabase-server'
import { buildCreatorUserPrompt, formatNotesBlock } from './parse'
import { buildGuidedSystemPrompt } from './prompts'
import { mapDocumentTypeToGenerationType } from './mapping'

interface OpenAiTextResult {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
}

export interface CreatorTextGenerationResult {
  text: string
  model: string
  provider: string
  pipeline: string
  inputTokens: number
  outputTokens: number
  actualCostCents: number
  reportId: string
  generationType: AiGenerationType
  finalUserPrompt: string
  finalSystemPrompt: string
}

function resolveCreatorTextModel() {
  return resolveOpenAiModel(
    process.env.OPENAI_ANSWER_MODEL ?? process.env.OPENAI_CHAT_MODEL,
    DEFAULT_OPENAI_TEXT_MODEL,
  )
}

export async function loadCreatorNotes(ownerId: string, payload: CreatorPayload): Promise<CreatorNoteRef[]> {
  if (payload.selectedNotes?.length) {
    return payload.selectedNotes
  }
  const ids = payload.annotationIds ?? []
  if (!ids.length) return []

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('annotations')
    .select('id, body, occurred_at, tags')
    .eq('owner_id', ownerId)
    .in('id', ids)

  if (error) {
    throw new PublicAiGenerationError('Não foi possível carregar as anotações selecionadas.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.occurred_at ? String(row.occurred_at).slice(0, 10) : undefined,
    label: Array.isArray(row.tags) && row.tags[0] ? String(row.tags[0]) : undefined,
    text: String(row.body ?? '').trim(),
  })).filter((note) => note.text.length > 0)
}

export async function requestCreatorOpenAiText(system: string, user: string, maxTokens = 4000): Promise<OpenAiTextResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Serviço de IA indisponível no momento.')
  }

  const model = resolveCreatorTextModel()
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(withOpenAiTemperature({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }, model, 0.4)),
  })

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    error?: { message?: string }
    model?: string
  } | null

  if (!response.ok) {
    console.error('[creator-v2] OpenAI HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Não foi possível gerar o documento agora. Tente novamente.')
  }

  const text = payload?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new PublicAiGenerationError('A IA não retornou conteúdo suficiente.')
  }

  const inputTokens = payload?.usage?.prompt_tokens ?? 0
  const outputTokens = payload?.usage?.completion_tokens ?? 0
  return {
    text,
    model: payload?.model ?? model,
    inputTokens,
    outputTokens,
    actualCostCents: estimateOpenAiTextCostCents(inputTokens, outputTokens),
  }
}

async function persistGeneratedReport(input: {
  ownerId: string
  generationType: AiGenerationType
  studentId?: string | null
  classId?: string | null
  promptVersion: string
  body: string
}) {
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
      body: input.body,
      coordinator_review_status: input.generationType === 'development_report' ? 'pending' : 'not_required',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new PublicAiGenerationError('Não foi possível salvar o documento gerado.')
  }
  return data.id
}

async function persistUsage(
  reportId: string,
  ownerId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costCents: number,
) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('reports_usage').insert({
    owner_id: ownerId,
    report_id: reportId,
    provider: 'openai',
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: costCents,
  })
  if (error) {
    throw new PublicAiGenerationError('Não foi possível registrar consumo do documento.')
  }
}

export async function generateCreatorTextDocument(input: {
  ownerId: string
  payload: CreatorPayload
  promptVersion: string
  classId?: string | null
  studentId?: string | null
}): Promise<CreatorTextGenerationResult> {
  const notes = await loadCreatorNotes(input.ownerId, input.payload)
  const needsNotes = input.payload.sourceMode !== 'prompt_only'
  if (needsNotes && notes.length === 0) {
    throw new PublicAiGenerationError('Selecione anotações para continuar ou mude a fonte do conteúdo.')
  }

  const system = buildGuidedSystemPrompt(input.payload.mode)
  const user = buildCreatorUserPrompt(input.payload, notes)
  const openAi = await requestCreatorOpenAiText(system, user)
  const cleanedText = stripMarkdownFromPedagogicalText(openAi.text)
  const generationType = mapDocumentTypeToGenerationType(input.payload.documentType)

  const reportId = await persistGeneratedReport({
    ownerId: input.ownerId,
    generationType,
    studentId: input.studentId,
    classId: input.classId,
    promptVersion: input.promptVersion,
    body: cleanedText,
  })

  await persistUsage(
    reportId,
    input.ownerId,
    openAi.model,
    openAi.inputTokens,
    openAi.outputTokens,
    openAi.actualCostCents,
  )

  return {
    text: cleanedText,
    model: openAi.model,
    provider: 'openai',
    pipeline: 'creator-v2-single-shot',
    inputTokens: openAi.inputTokens,
    outputTokens: openAi.outputTokens,
    actualCostCents: openAi.actualCostCents,
    reportId,
    generationType,
    finalUserPrompt: user,
    finalSystemPrompt: system,
  }
}

export async function improveTextWithOpenAi(system: string, user: string) {
  return requestCreatorOpenAiText(system, user, 1200)
}

export function buildCreatorPromptPreview(payload: CreatorPayload, notes: CreatorNoteRef[]) {
  return {
    system: buildGuidedSystemPrompt(payload.mode),
    user: buildCreatorUserPrompt(payload, notes),
    notesSummary: formatNotesBlock(notes),
  }
}
