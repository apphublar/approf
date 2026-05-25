import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { createSignedDownloadUrl, PERSONAL_DOCUMENT_CORS_HEADERS } from './helpers'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('teacher_personal_documents')
      .select('id, title, file_path, file_name, file_size, mime_type, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    if (error) throw toError(error, 'Não foi possível listar seus documentos.')

    const documents = await Promise.all((data ?? []).map(async (item) => ({
      id: item.id,
      name: item.file_name,
      title: item.title,
      filePath: item.file_path,
      mimeType: item.mime_type,
      size: item.file_size,
      uploadedAt: item.created_at,
      url: await createSignedDownloadUrl(item.file_path),
    })))

    return NextResponse.json({ documents }, { status: 200, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', 401)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível listar seus documentos.', 500)
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream'

    if (!filePath.startsWith(`${ownerId}/`) || !fileName || !Number.isFinite(fileSize)) {
      return jsonError('Dados do documento inválidos.', 400)
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('teacher_personal_documents')
      .insert({
        owner_id: ownerId,
        title: fileName,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
      })
      .select('id, title, file_path, file_name, file_size, mime_type, created_at')
      .single()

    if (error) throw toError(error, 'Não foi possível salvar o registro do documento.')

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
    }, { status: 200, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', 401)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível salvar seu documento.', 500)
  }
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
