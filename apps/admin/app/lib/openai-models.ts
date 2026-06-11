export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-5.5'
export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-5.5'
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'
export const DEFAULT_OPENAI_STANDALONE_IMAGE_MODEL = 'gpt-image-1-mini'
export const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

/** Preco oficial gpt-5.5 (USD por 1M tokens). */
export const DEFAULT_OPENAI_TEXT_INPUT_COST_PER_MILLION_USD = 5
export const DEFAULT_OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD = 30

export function resolveOpenAiModel(envValue: string | undefined, fallback: string) {
  const value = envValue?.trim()
  return value || fallback
}

/** Modelos recentes (gpt-5.x, o-series) so aceitam temperature padrao (1). */
export function supportsOpenAiTemperature(model: string) {
  const normalized = model.trim().toLowerCase()
  if (normalized.startsWith('gpt-5')) return false
  if (/^o\d/.test(normalized)) return false
  return true
}

export function withOpenAiTemperature<T extends Record<string, unknown>>(
  payload: T,
  model: string,
  temperature?: number,
): T {
  if (!supportsOpenAiTemperature(model)) return payload
  if (typeof temperature !== 'number') return payload
  return { ...payload, temperature }
}
