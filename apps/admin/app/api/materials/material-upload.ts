import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export const MATERIALS_CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export const MAX_MATERIAL_SIZE_MB = 10
export const MAX_MATERIAL_SIZE_BYTES = MAX_MATERIAL_SIZE_MB * 1024 * 1024
export const MATERIAL_BUCKET = 'material-files'

const MATERIAL_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aprovado: { type: 'boolean' },
    confianca: { type: 'number', minimum: 0, maximum: 1 },
    categoria_detectada: { type: 'string' },
    possui_dados_pessoais: { type: 'boolean' },
    possui_conteudo_inadequado: { type: 'boolean' },
    possui_imagem_sensivel: { type: 'boolean' },
    possui_direito_autoral_suspeito: { type: 'boolean' },
    motivo: { type: 'string' },
  },
  required: [
    'aprovado',
    'confianca',
    'categoria_detectada',
    'possui_dados_pessoais',
    'possui_conteudo_inadequado',
    'possui_imagem_sensivel',
    'possui_direito_autoral_suspeito',
    'motivo',
  ],
}

export type MaterialReview = {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteudo_inadequado: boolean
  possui_imagem_sensivel: boolean
  possui_direito_autoral_suspeito: boolean
  motivo: string
}

export type MaterialFileInfo = {
  name: string
  type: string
  size: number
}

export async function finalizeMaterialUpload(input: {
  ownerId: string
  title: string
  description: string
  file: MaterialFileInfo
  bytes: Buffer
  tempPath: string
}) {
  const supabase = createSupabaseServiceClient()
  const extractedText = extractReadableText(input.file, input.bytes)
  const review = await analyzeMaterialWithOpenAi({
    title: input.title,
    description: input.description,
    file: input.file,
    bytes: input.bytes,
    extractedText,
  })
  const status = resolveMaterialStatus(review)
  const extension = safeExtension(input.file.name)
  const publicPath = status === 'published'
    ? `${input.ownerId}/published/${crypto.randomUUID()}.${extension}`
    : input.tempPath

  if (status === 'published') {
    const { error: publishUploadError } = await supabase.storage.from(MATERIAL_BUCKET).upload(publicPath, input.bytes, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: false,
    })
    if (publishUploadError) throw toError(publishUploadError, 'Nao foi possivel publicar o arquivo aprovado.')
    await supabase.storage.from(MATERIAL_BUCKET).remove([input.tempPath])
  }

  const { data, error } = await supabase
    .from('materials')
    .insert({
      title: input.title,
      description: input.description,
      file_path: publicPath,
      file_name: input.file.name,
      file_type: input.file.type || extension,
      file_size_bytes: input.file.size,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      created_by: input.ownerId,
      submitted_by: input.ownerId,
      ai_review: review,
      ai_confidence: review.confianca,
      detected_category: review.categoria_detectada,
      content_preview: extractedText.slice(0, 2000),
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw toError(error, 'Nao foi possivel registrar o material analisado.')

  return {
    payload: {
      materialId: data?.id ?? null,
      status,
      review,
      extractedTextPreview: extractedText.slice(0, 1200),
    },
    remainingTempPath: status === 'published' ? null : input.tempPath,
  }
}

async function analyzeMaterialWithOpenAi(input: {
  title: string
  description: string
  file: MaterialFileInfo
  bytes: Buffer
  extractedText: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Servico de IA indisponivel no momento.')

  const model = process.env.OPENAI_MATERIAL_REVIEW_MODEL?.trim() || 'gpt-4o-mini'
  const prompt = buildMaterialReviewPrompt(input.title, input.description, input.file, input.extractedText)
  const viaResponses = await tryAnalyzeWithResponsesApi({ apiKey, model, prompt, file: input.file, bytes: input.bytes })
  if (viaResponses) return viaResponses

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  if (input.file.type.startsWith('image/')) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${input.file.type};base64,${input.bytes.toString('base64')}` },
    })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Voce analisa materiais pedagogicos para Educacao Infantil e responde apenas JSON valido no schema solicitado.' },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'material_review', strict: true, schema: MATERIAL_REVIEW_SCHEMA },
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  } | null
  if (!response.ok) {
    console.error('[materials/analyze-upload] OpenAI HTTP', response.status, payload?.error?.message)
    throw new Error('Nao foi possivel concluir a analise de IA do material.')
  }
  const raw = payload?.choices?.[0]?.message?.content
  if (!raw) throw new Error('A IA nao retornou uma analise valida.')
  return sanitizeReview(JSON.parse(raw) as Partial<MaterialReview>)
}

async function tryAnalyzeWithResponsesApi(input: {
  apiKey: string
  model: string
  prompt: string
  file: MaterialFileInfo
  bytes: Buffer
}) {
  const mimeType = input.file.type || inferMimeType(input.file.name)
  const dataUrl = `data:${mimeType};base64,${input.bytes.toString('base64')}`
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: input.prompt }]
  if (mimeType.startsWith('image/')) {
    content.push({ type: 'input_image', image_url: dataUrl })
  } else if (isDocumentForOpenAiFileInput(input.file.name, mimeType)) {
    content.push({ type: 'input_file', filename: input.file.name, file_data: dataUrl })
  } else {
    return null
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      input: [{ role: 'user', content }],
      text: {
        format: { type: 'json_schema', name: 'material_review', strict: true, schema: MATERIAL_REVIEW_SCHEMA },
      },
    }),
  })
  const payload = (await response.json().catch(() => null)) as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>
    error?: { message?: string }
  } | null
  if (!response.ok) {
    console.warn('[materials/analyze-upload] Responses API fallback', response.status, payload?.error?.message)
    return null
  }
  const raw = payload?.output_text
    ?? payload?.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === 'string')?.text
  if (!raw) return null
  return sanitizeReview(JSON.parse(raw) as Partial<MaterialReview>)
}

function buildMaterialReviewPrompt(title: string, description: string, file: MaterialFileInfo, extractedText: string) {
  return [
    'Analise o material antes da publicacao na comunidade do app Approf.',
    '',
    `Titulo informado: ${title}`,
    `Descricao informada: ${description}`,
    `Arquivo: ${file.name}`,
    `Tipo MIME: ${file.type || 'nao informado'}`,
    `Tamanho: ${file.size} bytes`,
    '',
    'Conteudo extraido do arquivo:',
    extractedText || '[Conteudo textual nao extraido automaticamente. Se houver imagem anexada, faca OCR visual. Audio e video nao sao formatos permitidos.]',
    '',
    'Criterios obrigatorios:',
    '- relacao com educacao infantil;',
    '- utilidade pedagogica;',
    '- CPF, telefone, e-mail, endereco, nomes completos de criancas e dados pessoais;',
    '- linguagem inadequada, ofensiva, propaganda ou spam;',
    '- imagem sensivel;',
    '- suspeita de direito autoral;',
    '- correspondencia entre conteudo, titulo e descricao.',
    '',
    'Bloqueie conteudo inadequado. Use confianca baixa quando o conteudo nao puder ser inspecionado suficientemente.',
  ].join('\n')
}

function extractReadableText(file: MaterialFileInfo, bytes: Buffer) {
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
    return bytes.toString('utf8').replace(/\u0000/g, ' ').trim()
  }
  if (mime.includes('json') || name.endsWith('.json')) {
    return bytes.toString('utf8').replace(/\u0000/g, ' ').trim()
  }
  return ''
}

function resolveMaterialStatus(review: MaterialReview): 'published' | 'review_required' | 'blocked' {
  const minimumConfidence = Number(process.env.MATERIAL_AI_CONFIDENCE_THRESHOLD ?? 0.82)
  if (review.possui_conteudo_inadequado || review.possui_imagem_sensivel || review.possui_dados_pessoais || review.aprovado === false) return 'blocked'
  if (review.confianca < minimumConfidence || review.possui_direito_autoral_suspeito) return 'review_required'
  return 'published'
}

function sanitizeReview(value: Partial<MaterialReview>): MaterialReview {
  return {
    aprovado: Boolean(value.aprovado),
    confianca: clampConfidence(value.confianca),
    categoria_detectada: typeof value.categoria_detectada === 'string' ? value.categoria_detectada : 'Nao identificada',
    possui_dados_pessoais: Boolean(value.possui_dados_pessoais),
    possui_conteudo_inadequado: Boolean(value.possui_conteudo_inadequado),
    possui_imagem_sensivel: Boolean(value.possui_imagem_sensivel),
    possui_direito_autoral_suspeito: Boolean(value.possui_direito_autoral_suspeito),
    motivo: typeof value.motivo === 'string' ? value.motivo : '',
  }
}

function clampConfidence(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(1, Math.max(0, number))
}

export function validateMaterialFile(file: MaterialFileInfo) {
  if (!isAllowedMaterialFile(file)) return 'Apenas documentos e imagens sao permitidos em materiais de apoio.'
  if (file.size > MAX_MATERIAL_SIZE_BYTES) return `O arquivo deve ter no maximo ${MAX_MATERIAL_SIZE_MB} MB.`
  return ''
}

function isAllowedMaterialFile(file: MaterialFileInfo) {
  if (file.type.startsWith('image/')) return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const lowerName = file.name.toLowerCase()
  return ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv'].some((extension) => lowerName.endsWith(extension))
}

function isDocumentForOpenAiFileInput(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase()
  return mimeType === 'application/pdf'
    || lowerName.endsWith('.pdf')
    || lowerName.endsWith('.docx')
    || lowerName.endsWith('.xlsx')
    || lowerName.endsWith('.pptx')
    || lowerName.endsWith('.txt')
    || lowerName.endsWith('.csv')
}

export function inferMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lowerName.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  if (lowerName.endsWith('.csv')) return 'text/csv'
  return 'application/octet-stream'
}

export function safeExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

export function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}
