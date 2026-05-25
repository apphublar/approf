import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  buildPersonalDocumentPath,
  createSignedDownloadUrl,
  PERSONAL_DOCUMENT_BUCKET,
  PERSONAL_DOCUMENT_CORS_HEADERS,
  validatePersonalDocument,
} from '../helpers'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return jsonError('Arquivo nao recebido pelo servidor.', 400)

    const fileName = file.name || 'arquivo'
    const mimeType = file.type || inferPersonalMimeType(fileName)
    const fileSize = file.size
    console.info('[personal-documents/upload-direct] request received', {
      ownerId,
      fileName,
      mimeType,
      fileSize,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
    })

    const validationError = validatePersonalDocument({ fileName, fileType: mimeType, fileSize })
    if (validationError) return jsonError(validationError, 400)

    const filePath = buildPersonalDocumentPath(ownerId, fileName)
    const bytes = Buffer.from(await file.arrayBuffer())
    const supabase = createSupabaseServiceClient()
    const { error: uploadError } = await supabase.storage
      .from(PERSONAL_DOCUMENT_BUCKET)
      .upload(filePath, bytes, {
        contentType: mimeType,
        upsert: false,
      })
    if (uploadError) throw toError(uploadError, 'Nao foi possivel salvar o arquivo no storage.')

    const { data, error } = await supabase
      .from('teacher_personal_documents')
      .insert({
        owner_id: ownerId,
        title: fileName,
        file_path: filePath,
        file_name: fileName,
        file_size: bytes.byteLength || fileSize,
        mime_type: mimeType,
      })
      .select('id, title, file_path, file_name, file_size, mime_type, created_at')
      .single()

    if (error) throw toError(error, 'Nao foi possivel salvar o registro do documento.')

    return NextResponse.json({
      document: {
        id: data.id,
        name: data.file_name,
        title: data.title,
        filePath: data.file_path,
        mimeType: data.mime_type,
        size: data.file_size,
        uploadedAt: data.created_at,
        url: await createSignedDownloadUrl(data.file_path),
      },
      uploadedVia: 'backend-direct',
    }, { status: 200, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessao expirada. Entre novamente.', 401)
    console.error('[personal-documents/upload-direct] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(error instanceof Error ? error.message : 'Nao foi possivel enviar seu documento.', 500)
  }
}

function inferPersonalMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.webp')) return 'image/webp'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  if (lowerName.endsWith('.doc')) return 'application/msword'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.odt')) return 'application/vnd.oasis.opendocument.text'
  if (lowerName.endsWith('.rtf')) return 'application/rtf'
  return 'application/octet-stream'
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
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
