import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

type UploadedVerificationDocument = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const form = await request.formData()
    const files = form
      .getAll('files')
      .filter((item): item is File => typeof File !== 'undefined' && item instanceof File)

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum arquivo recebido para upload.' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createSupabaseServiceClient()
    const uploaded: UploadedVerificationDocument[] = []

    for (const file of files.slice(0, 10)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `O arquivo ${file.name} excede o limite de 15 MB.` },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      const mimeType = (file.type || 'application/octet-stream').toLowerCase()
      if (mimeType !== 'application/octet-stream' && !ALLOWED_TYPES.has(mimeType)) {
        return NextResponse.json(
          { error: `Formato não suportado para ${file.name}. Use PDF, imagem, DOC/DOCX ou TXT.` },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name, extension)}`
      const { error } = await supabase.storage.from('profile-verification').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

      if (error) {
        return NextResponse.json(
          { error: `Falha ao enviar ${file.name}. ${error.message}` },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      uploaded.push({
        path,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      })
    }

    return NextResponse.json({ documents: uploaded }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível enviar os documentos agora.' },
      { status: 400, headers: CORS_HEADERS },
    )
  }
}

function sanitizeFileName(fileName: string, fallbackExtension: string) {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  if (!sanitized) return `arquivo.${fallbackExtension}`
  return sanitized.includes('.') ? sanitized : `${sanitized}.${fallbackExtension}`
}
