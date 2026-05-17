import { PublicAiGenerationError } from './ai-generation'

interface TranscribeAudioInput {
  audio: File
  durationSeconds: number
}

interface TranscribeAudioResult {
  transcript: string
  provider: string
  model: string
  durationSeconds: number
  actualCostCents: number
}

const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'
const DEFAULT_TRANSCRIPTION_COST_CENTS = 2
const MAX_AUDIO_SECONDS = 30
const MAX_AUDIO_BYTES = 6 * 1024 * 1024

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  if (input.durationSeconds > MAX_AUDIO_SECONDS + 1) {
    throw new PublicAiGenerationError('O audio pode ter no maximo 30 segundos.')
  }

  if (input.audio.size > MAX_AUDIO_BYTES) {
    throw new PublicAiGenerationError('O audio ficou muito grande. Grave novamente com ate 30 segundos.')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new PublicAiGenerationError('Servico de transcricao indisponivel no momento. Tente novamente em instantes.')
  }

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL
  const form = new FormData()
  form.append('file', input.audio, input.audio.name || 'anotacao.webm')
  form.append('model', model)
  form.append('language', 'pt')
  form.append('response_format', 'json')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  const payload = (await response.json().catch(() => null)) as {
    text?: string
    error?: { message?: string }
  } | null

  if (!response.ok) {
    console.error('[ai-transcription] OpenAI HTTP', response.status, payload?.error?.message)
    throw new PublicAiGenerationError('Nao foi possivel transcrever o audio agora. Tente novamente em instantes.')
  }

  const transcript = payload?.text?.trim()
  if (!transcript) {
    throw new PublicAiGenerationError('A IA nao conseguiu identificar fala suficiente no audio.')
  }

  return {
    transcript,
    provider: 'openai',
    model,
    durationSeconds: Math.min(MAX_AUDIO_SECONDS, Math.max(0, Math.round(input.durationSeconds))),
    actualCostCents: resolveTranscriptionCostCents(),
  }
}

function resolveTranscriptionCostCents() {
  const fromEnv = Number(process.env.OPENAI_TRANSCRIPTION_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return DEFAULT_TRANSCRIPTION_COST_CENTS
}
