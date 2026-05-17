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
  const audioFile = normalizeAudioFile(input.audio)
  const form = new FormData()
  form.append('file', audioFile, audioFile.name)
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
    const openAiMessage = payload?.error?.message
    console.error('[ai-transcription] OpenAI HTTP', response.status, openAiMessage)
    throw new PublicAiGenerationError(getPublicOpenAiErrorMessage(response.status, openAiMessage))
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

function normalizeAudioFile(audio: File) {
  const mimeType = audio.type || 'audio/webm'
  const name = audio.name && hasSupportedAudioExtension(audio.name)
    ? audio.name
    : getAudioFilename(mimeType)

  if (audio.name === name && audio.type) return audio
  return new File([audio], name, { type: mimeType })
}

function hasSupportedAudioExtension(name: string) {
  return /\.(flac|m4a|mp3|mp4|mpeg|mpga|oga|ogg|wav|webm)$/i.test(name)
}

function getAudioFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'anotacao.mp4'
  if (mimeType.includes('mpeg')) return 'anotacao.mp3'
  if (mimeType.includes('wav')) return 'anotacao.wav'
  if (mimeType.includes('ogg')) return 'anotacao.ogg'
  return 'anotacao.webm'
}

function getPublicOpenAiErrorMessage(status: number, message?: string) {
  const normalized = message?.toLowerCase() ?? ''
  if (status === 401 || status === 403) {
    return 'A chave da OpenAI no servidor nao autorizou a transcricao. Verifique a OPENAI_API_KEY na Vercel.'
  }
  if (status === 404 || normalized.includes('model')) {
    return 'O modelo de transcricao configurado nao esta disponivel nesta conta da OpenAI. Verifique OPENAI_TRANSCRIPTION_MODEL.'
  }
  if (normalized.includes('format') || normalized.includes('file') || normalized.includes('audio')) {
    return 'A OpenAI nao aceitou o formato do audio. Grave novamente e tente transcrever outra vez.'
  }
  if (status === 429) {
    return 'A OpenAI recusou a transcricao por limite de uso. Tente novamente em instantes.'
  }
  return 'Nao foi possivel transcrever o audio agora. Tente novamente em instantes.'
}

function resolveTranscriptionCostCents() {
  const fromEnv = Number(process.env.OPENAI_TRANSCRIPTION_COST_CENTS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)
  return DEFAULT_TRANSCRIPTION_COST_CENTS
}
