import {
  DEFAULT_OPENAI_TEXT_INPUT_COST_PER_MILLION_USD,
  DEFAULT_OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD,
} from './openai-models'

export function resolveUsdToBrlRate() {
  const fromEnv = Number(process.env.AI_USD_TO_BRL)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 5.5
}

export function resolveOpenAiTextInputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_INPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return DEFAULT_OPENAI_TEXT_INPUT_COST_PER_MILLION_USD
}

export function resolveOpenAiTextOutputUsdPerMillion() {
  const fromEnv = Number(process.env.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return DEFAULT_OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD
}

export function estimateOpenAiTextCostCents(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens / 1_000_000) * resolveOpenAiTextInputUsdPerMillion()
    + (outputTokens / 1_000_000) * resolveOpenAiTextOutputUsdPerMillion()
  const brlApprox = usd * resolveUsdToBrlRate()
  return Math.max(1, Math.round(brlApprox * 100))
}

/** Estimativa conservadora a partir do tamanho do texto (≈4 chars/token). */
export function estimateTextReservationCostCents(promptText: string, expectedOutputTokens = 1800) {
  const inputTokens = Math.max(800, Math.ceil(promptText.length / 4))
  const outputTokens = expectedOutputTokens
  const raw = estimateOpenAiTextCostCents(inputTokens, outputTokens)
  return Math.max(15, Math.round(raw * 1.15))
}

export function estimateImproveReservationCostCents(text: string) {
  const inputTokens = Math.max(200, Math.ceil(text.length / 4))
  return Math.max(8, estimateOpenAiTextCostCents(inputTokens, 600))
}

export function costCentsToGizTokens(costCents: number) {
  return Math.max(0, Math.round(costCents * 10))
}
