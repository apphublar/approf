import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'

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

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const form = await request.formData()
    const files = form
      .getAll('files')
      .filter((item): item is File => typeof File !== 'undefined' && item instanceof File)

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum arquivo recebido para upload.' }, { status: 400, headers: corsHeaders })
    }

    const supabase = createSupabaseServiceClient()
    const uploaded: UploadedVerificationDocument[] = []

    for (const file of files.slice(0, 10)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `O arquivo ${file.name} excede o limite de 15 MB.` },
          { status: 400, headers: corsHeaders },
        )
      }

      const mimeType = (file.type || 'application/octet-stream').toLowerCase()
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const allowedByExtension = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt'].includes(extension)
      if (mimeType !== 'application/octet-stream' && !ALLOWED_TYPES.has(mimeType) && !allowedByExtension) {
        return NextResponse.json(
          { error: `Formato não suportado para ${file.name}. Use PDF, imagem, DOC/DOCX ou TXT.` },
          { status: 400, headers: corsHeaders },
        )
      }

      const safeExtension = extension || 'bin'
      const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name, safeExtension)}`
      const { error } = await supabase.storage.from('profile-verification').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

      if (error) {
        return NextResponse.json(
          { error: `Falha ao enviar ${file.name}. ${error.message}` },
          { status: 400, headers: corsHeaders },
        )
      }

      uploaded.push({
        path,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      })
    }

    return NextResponse.json({ documents: uploaded }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível enviar os documentos agora.' },
      { status: 400, headers: corsHeaders },
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
