import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export const MATERIALS_CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export const MAX_MATERIAL_SIZE_MB = 10
export const MAX_MATERIAL_SIZE_BYTES = MAX_MATERIAL_SIZE_MB * 1024 * 1024
export const MATERIAL_BUCKET = 'material-apoio'

const MATERIAL_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aprovado: { type: 'boolean' },
    confianca: { type: 'number', minimum: 0, maximum: 1 },
    categoria_detectada: { type: 'string' },
    possui_dados_pessoais: { type: 'boolean' },
    possui_conteúdo_inadequado: { type: 'boolean' },
    possui_imagem_sensível: { type: 'boolean' },
    possui_direito_autoral_suspeito: { type: 'boolean' },
    motivo: { type: 'string' },
  },
  required: [
    'aprovado',
    'confianca',
    'categoria_detectada',
    'possui_dados_pessoais',
    'possui_conteúdo_inadequado',
    'possui_imagem_sensível',
    'possui_direito_autoral_suspeito',
    'motivo',
  ],
}

export type MaterialReview = {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteúdo_inadequado: boolean
  possui_imagem_sensível: boolean
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
  ageRange?: string | null
  pedagogicalObjective?: string | null
  file: MaterialFileInfo
  bytes: Buffer
  tempPath: string
}) {
  const supabase = createSupabaseServiceClient()

  console.info('[materials/upload] step 1 — fetching author profile', { ownerId: input.ownerId })
  const profile = await getAuthorProfile(input.ownerId)
  console.info('[materials/upload] step 1 — profile fetched', { name: profile.name, hasAvatar: Boolean(profile.avatar) })

  const insertPayload = {
    title: input.title,
    description: input.description,
    // 0020 columns
    type: input.file.type.startsWith('image/') ? 'image' : 'document',
    age_range: input.ageRange?.trim() || null,
    pedagogical_objective: input.pedagogicalObjective?.trim() || input.description,
    file_url: null as null,
    file_size: input.file.size,
    mime_type: input.file.type || inferMimeType(input.file.name),
    author_id: input.ownerId,
    author_name: profile.name,
    author_avatar: profile.avatar,
    ai_analysis_status: 'pending',
    // 0019 columns
    ai_review: {} as Record<string, unknown>,
    content_preview: '',
    submitted_by: input.ownerId,
    // 0001 columns
    file_path: input.tempPath,
    file_name: input.file.name,
    file_type: input.file.type || safeExtension(input.file.name),
    file_size_bytes: input.file.size,
    status: 'em_analise',
    published_at: null as null,
    created_by: input.ownerId,
  }

  console.info('[materials/upload] step 2 — inserting material record', {
    ownerId: input.ownerId,
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSize: input.file.size,
    tempPath: input.tempPath,
    status: insertPayload.status,
  })

  const initial = await supabase
    .from('materials')
    .insert(insertPayload)
    .select('id')
    .single()

  if (initial.error) {
    const err = initial.error as { message?: string; code?: string; details?: string; hint?: string }
    console.error('[materials/upload] step 2 FAILED — DB insert error', {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
    })
    throw toError(initial.error, 'Não foi possível registrar o material enviado.')
  }

  const materialId = initial.data?.id ?? null
  console.info('[materials/upload] step 2 — material record created', { materialId })

  const extractedText = extractReadableText(input.file, input.bytes)
  console.info('[materials/upload] step 3 — starting AI analysis', { materialId, extractedTextLength: extractedText.length })

  try {
    const review = await analyzeMaterialWithOpenAi({
      title: input.title,
      description: input.description,
      file: input.file,
      bytes: input.bytes,
      extractedText,
    })
    const status = resolveMaterialStatus(review)
    const aiAnalysisStatus = status === 'published' ? 'approved' : status === 'blocked' ? 'blocked' : 'review_required'
    console.info('[materials/upload] step 3 — AI analysis complete', { materialId, status, aiAnalysisStatus, confianca: review.confianca })

    const signed = await supabase.storage.from(MATERIAL_BUCKET).createSignedUrl(input.tempPath, 60 * 60)
    if (signed.error) {
      console.warn('[materials/upload] step 3 — signed URL generation failed (non-fatal)', signed.error.message)
    }

    const update = await supabase
      .from('materials')
      .update({
        status,
        ai_analysis_status: aiAnalysisStatus,
        ai_review: review,
        ai_confidence: review.confianca,
        detected_category: review.categoria_detectada,
        content_preview: extractedText.slice(0, 2000),
        file_url: signed.data?.signedUrl ?? null,
        published_at: status === 'published' ? new Date().toISOString() : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', materialId)
      .select('id')
      .single()

    if (update.error) {
      const err = update.error as { message?: string; code?: string; details?: string; hint?: string }
      console.error('[materials/upload] step 3 FAILED — DB update error', {
        code: err.code,
        message: err.message,
        details: err.details,
        hint: err.hint,
      })
      throw toError(update.error, 'Não foi possível atualizar o material analisado.')
    }

    console.info('[materials/upload] step 3 — material updated successfully', { materialId, status })

    return {
      payload: {
        materialId,
        status,
        review,
        extractedTextPreview: extractedText.slice(0, 1200),
      },
      remainingTempPath: null,
    }
  } catch (error) {
    console.error('[materials/upload] step 3 — AI analysis or update failed (using fallback)', {
      error: error instanceof Error ? error.message : String(error),
    })
    const fallbackReview = sanitizeReview({
      aprovado: false,
      confianca: 0,
      categoria_detectada: 'Em analise',
      motivo: 'Material enviado com sucesso. A análise de IA ficara pendente para revisão.',
    })
    await supabase
      .from('materials')
      .update({
        status: 'em_analise',
        ai_analysis_status: 'failed',
        ai_review: fallbackReview,
        content_preview: extractedText.slice(0, 2000),
      })
      .eq('id', materialId)

    return {
      payload: {
        materialId,
        status: 'em_analise' as const,
        review: fallbackReview,
        extractedTextPreview: extractedText.slice(0, 1200),
      },
      remainingTempPath: null,
    }
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
  if (!apiKey) throw new Error('Serviço de IA indisponível no momento.')

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
        { role: 'system', content: 'Você analisa materiais pedagogicos para Educação Infantil e responde apenas JSON válido no schema solicitado.' },
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
    console.error('[materials/upload] OpenAI Chat Completions error', response.status, payload?.error?.message)
    throw new Error('Não foi possível concluir a análise de IA do material.')
  }
  const raw = payload?.choices?.[0]?.message?.content
  if (!raw) throw new Error('A IA não retornou uma análise válida.')
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
    console.warn('[materials/upload] Responses API fallback to Chat Completions', response.status, payload?.error?.message)
    return null
  }
  const raw = payload?.output_text
    ?? payload?.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === 'string')?.text
  if (!raw) return null
  return sanitizeReview(JSON.parse(raw) as Partial<MaterialReview>)
}

function buildMaterialReviewPrompt(title: string, description: string, file: MaterialFileInfo, extractedText: string) {
  return [
    'Analise o material antes da publicação na comunidade do app Approf.',
    '',
    `Título informado: ${title}`,
    `Descrição informada: ${description}`,
    `Arquivo: ${file.name}`,
    `Tipo MIME: ${file.type || 'não informado'}`,
    `Tamanho: ${file.size} bytes`,
    '',
    'Conteúdo extraido do arquivo:',
    extractedText || '[Conteúdo textual nao extraido automaticamente. Se houver imagem anexada, faca OCR visual. Audio e video nao sao formatos permitidos.]',
    '',
    'Criterios obrigatorios:',
    '- relação com educação infantil;',
    '- utilidade pedagógica;',
    '- CPF, telefone, e-mail, endereço, nomes completos de crianças e dados pessoais;',
    '- linguagem inadequada, ofensiva, propaganda ou spam;',
    '- imagem sensível;',
    '- suspeita de direito autoral, apenas como informacao complementar;',
    '- correspondencia entre conteúdo, título e descrição.',
    '',
    'Direito autoral suspeito não deve impedir aprovacao automatica. O ponto critico e impedir dados pessoais e imagens sensíveis/crianças identificáveis.',
    'Bloqueie conteúdo inadequado. Use confianca baixa quando o conteúdo nao puder ser inspecionado suficientemente.',
  ].join('\n')
}

function extractReadableText(file: MaterialFileInfo, bytes: Buffer) {
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
    return bytes.toString('utf8').replace(/ /g, ' ').trim()
  }
  if (mime.includes('json') || name.endsWith('.json')) {
    return bytes.toString('utf8').replace(/ /g, ' ').trim()
  }
  return ''
}

function resolveMaterialStatus(review: MaterialReview): 'published' | 'review_required' | 'blocked' {
  const minimumConfidence = Number(process.env.MATERIAL_AI_CONFIDENCE_THRESHOLD ?? 0.6)
  if (review.possui_conteúdo_inadequado || review.aprovado === false) return 'blocked'
  if (review.possui_imagem_sensível || review.possui_dados_pessoais) return 'review_required'
  if (review.confianca < minimumConfidence) return 'review_required'
  return 'published'
}

function sanitizeReview(value: Partial<MaterialReview>): MaterialReview {
  return {
    aprovado: Boolean(value.aprovado),
    confianca: clampConfidence(value.confianca),
    categoria_detectada: typeof value.categoria_detectada === 'string' ? value.categoria_detectada : 'Nao identificada',
    possui_dados_pessoais: Boolean(value.possui_dados_pessoais),
    possui_conteúdo_inadequado: Boolean(value.possui_conteúdo_inadequado),
    possui_imagem_sensível: Boolean(value.possui_imagem_sensível),
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
  const lowerName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) return true
  if (['.jpg', '.jpeg', '.png', '.webp'].some((extension) => lowerName.endsWith(extension))) return true
  return ['.pdf', '.docx', '.xlsx', '.pptx'].some((extension) => lowerName.endsWith(extension))
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

export function safeFileName(fileName: string) {
  const normalized = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const parts = normalized.split('.')
  const extension = safeExtension(fileName)
  const base = (parts.length > 1 ? parts.slice(0, -1).join('.') : normalized)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'arquivo'
  return `${base}.${extension}`
}

async function getAuthorProfile(ownerId: string) {
  const { data, error } = await createSupabaseServiceClient()
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) {
    console.warn('[materials/upload] profile fetch failed (non-fatal)', { ownerId, error: error.message })
  }
  return {
    name: typeof data?.full_name === 'string' ? data.full_name : 'Professora',
    avatar: typeof data?.avatar_url === 'string' ? data.avatar_url : null,
  }
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
