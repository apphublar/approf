import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}
const MAX_MATERIAL_SIZE_MB = 10
const MAX_MATERIAL_SIZE_BYTES = MAX_MATERIAL_SIZE_MB * 1024 * 1024

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

type MaterialReview = {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteudo_inadequado: boolean
  possui_imagem_sensivel: boolean
  possui_direito_autoral_suspeito: boolean
  motivo: string
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  let tempPath: string | null = null

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const file = form.get('file')

    if (!title) {
      return NextResponse.json({ error: 'Informe o tema ou nome do arquivo.' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!description) {
      return NextResponse.json({ error: 'Informe a descrição do material.' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Selecione um arquivo para análise.' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!isAllowedMaterialFile(file)) {
      return NextResponse.json(
        { error: 'Apenas documentos e imagens são permitidos em materiais de apoio.' },
        { status: 400, headers: CORS_HEADERS },
      )
    }
    if (file.size > MAX_MATERIAL_SIZE_BYTES) {
      return NextResponse.json({ error: `O arquivo deve ter no maximo ${MAX_MATERIAL_SIZE_MB} MB.` }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createSupabaseServiceClient()
    const bytes = Buffer.from(await file.arrayBuffer())
    const extension = safeExtension(file.name)
    tempPath = `${ownerId}/tmp/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('material-files').upload(tempPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uploadError) throw toError(uploadError, 'Não foi possível fazer upload temporário do material.')

    const extractedText = extractReadableText(file, bytes)
    const review = await analyzeMaterialWithOpenAi({
      title,
      description,
      file,
      bytes,
      extractedText,
    })
    const status = resolveMaterialStatus(review)

    const publicPath = status === 'published'
      ? `${ownerId}/published/${crypto.randomUUID()}.${extension}`
      : tempPath

    if (status === 'published') {
      const { error: publishUploadError } = await supabase.storage.from('material-files').upload(publicPath, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (publishUploadError) throw toError(publishUploadError, 'Não foi possível publicar o arquivo aprovado.')
      await supabase.storage.from('material-files').remove([tempPath])
      tempPath = null
    }

    let materialId: string | null = null
    try {
      const { data, error } = await supabase
        .from('materials')
        .insert({
          title,
          description,
          file_path: publicPath,
          file_name: file.name,
          file_type: file.type || extension,
          file_size_bytes: file.size,
          status,
          published_at: status === 'published' ? new Date().toISOString() : null,
          created_by: ownerId,
          submitted_by: ownerId,
          ai_review: review,
          ai_confidence: review.confianca,
          detected_category: review.categoria_detectada,
          content_preview: extractedText.slice(0, 2000),
          reviewed_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error
      materialId = data?.id ?? null
    } catch (dbError) {
      console.warn('[materials/analyze-upload] material insert skipped', dbError)
    }

    return NextResponse.json(
      {
        materialId,
        status,
        review,
        extractedTextPreview: extractedText.slice(0, 1200),
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    if (tempPath) {
      try {
        await createSupabaseServiceClient().storage.from('material-files').remove([tempPath])
      } catch {
        // Best-effort temporary file cleanup.
      }
    }

    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: error.status, headers: CORS_HEADERS })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível analisar o material agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

async function analyzeMaterialWithOpenAi(input: {
  title: string
  description: string
  file: File
  bytes: Buffer
  extractedText: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Serviço de IA indisponível no momento.')

  const model = process.env.OPENAI_MATERIAL_REVIEW_MODEL?.trim() || 'gpt-4o-mini'
  const prompt = buildMaterialReviewPrompt(input.title, input.description, input.file, input.extractedText)
  const viaResponses = await tryAnalyzeWithResponsesApi({
    apiKey,
    model,
    prompt,
    file: input.file,
    bytes: input.bytes,
  })
  if (viaResponses) return viaResponses

  const isImage = input.file.type.startsWith('image/')
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: prompt,
    },
  ]

  if (isImage) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${input.file.type};base64,${input.bytes.toString('base64')}`,
      },
    })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Você analisa materiais pedagógicos para Educação Infantil e responde apenas JSON válido no schema solicitado.',
        },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'material_review',
          strict: true,
          schema: MATERIAL_REVIEW_SCHEMA,
        },
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  } | null

  if (!response.ok) {
    console.error('[materials/analyze-upload] OpenAI HTTP', response.status, payload?.error?.message)
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
  file: File
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
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'material_review',
          strict: true,
          schema: MATERIAL_REVIEW_SCHEMA,
        },
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

function buildMaterialReviewPrompt(title: string, description: string, file: File, extractedText: string) {
  return [
    'Analise o material antes da publicação na comunidade do app Approf.',
    '',
    `Título informado: ${title}`,
    `Descrição informada: ${description}`,
    `Arquivo: ${file.name}`,
    `Tipo MIME: ${file.type || 'não informado'}`,
    `Tamanho: ${file.size} bytes`,
    '',
    'Conteúdo extraído do arquivo:',
    extractedText || '[Conteudo textual nao extraido automaticamente. Se houver imagem anexada, faca OCR visual. Audio e video nao sao formatos permitidos.]',
    '',
    'Critérios obrigatórios:',
    '- relação com educação infantil;',
    '- utilidade pedagógica;',
    '- CPF, telefone, e-mail, endereço, nomes completos de crianças e dados pessoais;',
    '- linguagem inadequada, ofensiva, propaganda ou spam;',
    '- imagem sensível;',
    '- suspeita de direito autoral;',
    '- correspondência entre conteúdo, título e descrição.',
    '',
    'Bloqueie conteúdo inadequado. Use confiança baixa quando o conteúdo não puder ser inspecionado suficientemente.',
  ].join('\n')
}

function extractReadableText(file: File, bytes: Buffer) {
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
  if (
    review.possui_conteudo_inadequado ||
    review.possui_imagem_sensivel ||
    review.possui_dados_pessoais ||
    review.aprovado === false
  ) {
    return 'blocked'
  }
  if (review.confianca < minimumConfidence || review.possui_direito_autoral_suspeito) {
    return 'review_required'
  }
  return 'published'
}

function sanitizeReview(value: Partial<MaterialReview>): MaterialReview {
  return {
    aprovado: Boolean(value.aprovado),
    confianca: clampConfidence(value.confianca),
    categoria_detectada: typeof value.categoria_detectada === 'string' ? value.categoria_detectada : 'Não identificada',
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

function safeExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
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

function isAllowedMaterialFile(file: File) {
  if (file.type.startsWith('image/')) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  }
  const lowerName = file.name.toLowerCase()
  return ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv'].some((extension) => lowerName.endsWith(extension))
}

function inferMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lowerName.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  if (lowerName.endsWith('.csv')) return 'text/csv'
  return 'application/octet-stream'
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
