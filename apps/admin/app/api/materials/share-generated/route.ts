import { NextResponse } from 'next/server'
import { getOwnerReportById } from '@/app/lib/reports'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const SHARE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    shareableBody: { type: 'string' },
    review: {
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
    },
  },
  required: ['title', 'description', 'shareableBody', 'review'],
}

const REVIEW_SCHEMA = {
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

type MaterialReview = {
  aprovado: boolean
  confianca: number
  categoria_detectada: string
  possui_dados_pessoais: boolean
  possui_conteúdo_inadequado: boolean
  possui_imagem_sensível: boolean
  possui_direito_autoral_suspeito: boolean
  motivo: string
}

type SharePreview = {
  title: string
  description: string
  shareableBody: string
  review: MaterialReview
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = typeof body.action === 'string' ? body.action : ''
    const reportId = typeof body.reportId === 'string' ? body.reportId : ''

    if (!['preview', 'publish'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!reportId) {
      return NextResponse.json({ error: 'Documento inválido.' }, { status: 400, headers: CORS_HEADERS })
    }

    const report = await getOwnerReportById(ownerId, reportId)
    if (!report) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404, headers: CORS_HEADERS })
    }

    if (action === 'publish') {
      const preview = sanitizeClientPreview(body)
      const finalReview = await reviewShareableText(preview)
      const finalPreview = { ...preview, review: finalReview }
      const status = resolveMaterialStatus(finalReview)
      if (status !== 'published') {
        return NextResponse.json(
          { error: 'A versao anonimizada ainda precisa ser revisada antes da publicação.' },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      const materialId = await publishShareableMaterial({
        ownerId,
        reportId,
        reportType: String(report.report_type ?? ''),
        preview: finalPreview,
      })

      return NextResponse.json({ ...finalPreview, materialId, status }, { status: 200, headers: CORS_HEADERS })
    }

    const preview = await createShareablePreview({
      report,
      preferredTitle: typeof body.title === 'string' ? body.title : '',
      preferredDescription: typeof body.description === 'string' ? body.description : '',
    })

    return NextResponse.json(preview, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[materials/share-generated] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível preparar o material agora.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

async function reviewShareableText(preview: SharePreview) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Serviço de IA indisponível no momento.')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MATERIAL_REVIEW_MODEL?.trim() || 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Valide a versao final antes de publicar como material de apoio.',
                'Ela deve estar anonimizada e não pode conter nomes reais de crianças, escola, responsaveis, endereço, telefone, email, documentos, imagem sensível, propaganda ou conteúdo inadequado. Direito autoral suspeito deve ser sinalizado apenas como informacao complementar.',
                '',
                `Título: ${preview.title}`,
                `Descrição: ${preview.description}`,
                '',
                preview.shareableBody,
              ].join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'material_final_review',
          strict: true,
          schema: REVIEW_SCHEMA,
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
    console.error('[materials/share-generated/final-review] OpenAI HTTP', response.status, payload?.error?.message)
    throw new Error('Não foi possível válidar a versao final do material.')
  }

  const raw = payload?.output_text
    ?? payload?.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === 'string')?.text
  if (!raw) throw new Error('A IA não retornou a válidacao final do material.')
  return sanitizeReview(JSON.parse(raw) as Partial<MaterialReview>)
}

async function createShareablePreview(input: {
  report: Record<string, unknown>
  preferredTitle: string
  preferredDescription: string
}): Promise<SharePreview> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Serviço de IA indisponível no momento.')

  const artifacts = isRecord(input.report.ai_artifacts) ? input.report.ai_artifacts : null
  const imageDataUrl = typeof artifacts?.imageDataUrl === 'string' ? artifacts.imageDataUrl : ''
  const isImage = Boolean(imageDataUrl)
  const prompt = buildSharePrompt({
    reportType: String(input.report.report_type ?? ''),
    body: typeof input.report.body === 'string' ? input.report.body : '',
    preferredTitle: input.preferredTitle,
    preferredDescription: input.preferredDescription,
    isImage,
  })
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }]
  if (isImage) {
    content.push({ type: 'input_image', image_url: imageDataUrl })
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MATERIAL_REVIEW_MODEL?.trim() || 'gpt-4o-mini',
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'generated_material_share',
          strict: true,
          schema: SHARE_SCHEMA,
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
    console.error('[materials/share-generated] OpenAI HTTP', response.status, payload?.error?.message)
    throw new Error('Não foi possível anonimizar o material com IA.')
  }

  const raw = payload?.output_text
    ?? payload?.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === 'string')?.text
  if (!raw) throw new Error('A IA não retornou uma versao compartilhavel válida.')
  return sanitizeSharePreview(JSON.parse(raw) as Partial<SharePreview>)
}

function buildSharePrompt(input: {
  reportType: string
  body: string
  preferredTitle: string
  preferredDescription: string
  isImage: boolean
}) {
  return [
    'Crie uma versao segura para publicar como Material de Apoio da comunidade Approf.',
    'O arquivo original nunca deve ser publicado.',
    '',
    `Tipo gerado: ${input.reportType}`,
    `Título sugerido pela professora: ${input.preferredTitle || '[não informado]'}`,
    `Descrição sugerida pela professora: ${input.preferredDescription || '[nao informada]'}`,
    '',
    input.isImage
      ? 'A professora gerou uma imagem. Analise a imagem anexada e crie uma referencia textual de exemplo. Nao reutilize a imagem original, nao descreva rostos identificáveis, uniformes, escola ou crianças reais.'
      : 'A professora gerou um documento. Reescreva o conteúdo como exemplo pedagogico anonimo.',
    '',
    'Regras obrigatorias:',
    '- Remova nomes reais de crianças, responsaveis, professoras quando forem dados de caso real, escola, endereço, telefone, email, documentos e qualquer identificador.',
    '- Troque nomes de crianças por nomes ficticios curtos e mantenhá coerencia.',
    '- Se houver imagem de criança ou dado visual identificavel, nao publique a imagem; substitua por uma referencia textual de exemplo.',
    '- Inclua no texto a ideia de "referencia de exemplo" ou "exemplo ficticio anonimizado".',
    '- Mantenha utilidade pedagógica para educação infantil.',
    '- Depois de anonimizar, revise se ainda existe dado pessoal ou conteúdo sensível.',
    '',
    'Conteúdo do documento gerado:',
    input.body || '[sem texto; use a imagem anexada como base apenas para criar referencia anonima]',
  ].join('\n')
}

async function publishShareableMaterial(input: {
  ownerId: string
  reportId: string
  reportType: string
  preview: SharePreview
}) {
  const supabase = createSupabaseServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', input.ownerId)
    .maybeSingle()
  const { data, error } = await supabase
    .from('materials')
    .insert({
      title: input.preview.title,
      description: input.preview.description,
      type: 'document',
      pedagogical_objective: input.preview.description,
      file_path: null,
      file_name: null,
      file_type: 'text/shareable-generated',
      file_size_bytes: Buffer.byteLength(input.preview.shareableBody, 'utf8'),
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: input.ownerId,
      submitted_by: input.ownerId,
      author_id: input.ownerId,
      author_name: typeof profile?.full_name === 'string' ? profile.full_name : 'Professora',
      author_avatar: typeof profile?.avatar_url === 'string' ? profile.avatar_url : null,
      ai_analysis_status: 'approved',
      ai_review: {
        ...input.preview.review,
        source_report_id: input.reportId,
        source_report_type: input.reportType,
      },
      ai_confidence: input.preview.review.confianca,
      detected_category: input.preview.review.categoria_detectada,
      content_preview: input.preview.shareableBody.slice(0, 4000),
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw toError(error, 'Não foi possível publicar o material anonimizado.')
  return data?.id ?? null
}

function sanitizeClientPreview(value: Record<string, unknown>): SharePreview {
  return sanitizeSharePreview({
    title: typeof value.title === 'string' ? value.title : '',
    description: typeof value.description === 'string' ? value.description : '',
    shareableBody: typeof value.shareableBody === 'string' ? value.shareableBody : '',
    review: isRecord(value.review) ? value.review as Partial<MaterialReview> : undefined,
  })
}

function sanitizeSharePreview(value: {
  title?: string
  description?: string
  shareableBody?: string
  review?: Partial<MaterialReview>
}): SharePreview {
  const title = typeof value.title === 'string' && value.title.trim()
    ? value.title.trim()
    : 'Material de apoio anonimizado'
  const description = typeof value.description === 'string' && value.description.trim()
    ? value.description.trim()
    : 'Referencia de exemplo gerada a partir de material pedagogico anonimizado.'
  const shareableBody = typeof value.shareableBody === 'string' ? value.shareableBody.trim() : ''
  if (shareableBody.length < 80) {
    throw new Error('A versao anonimizada precisa ter mais conteúdo antes da publicação.')
  }
  return {
    title: title.slice(0, 160),
    description: description.slice(0, 600),
    shareableBody,
    review: sanitizeReview(value.review ?? {}),
  }
}

function resolveMaterialStatus(review: MaterialReview): 'published' | 'review_required' | 'blocked' {
  const minimumConfidence = Number(process.env.MATERIAL_AI_CONFIDENCE_THRESHOLD ?? 0.6)
  if (
    review.possui_conteúdo_inadequado ||
    review.aprovado === false
  ) {
    return 'blocked'
  }
  if (review.possui_imagem_sensível || review.possui_dados_pessoais) {
    return 'review_required'
  }
  if (review.confianca < minimumConfidence) {
    return 'review_required'
  }
  return 'published'
}

function sanitizeReview(value: Partial<MaterialReview>): MaterialReview {
  return {
    aprovado: Boolean(value.aprovado),
    confianca: clampConfidence(value.confianca),
    categoria_detectada: typeof value.categoria_detectada === 'string' ? value.categoria_detectada : 'Exemplo pedagogico',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
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
