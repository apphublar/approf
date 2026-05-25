import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  buildPersonalDocumentPath,
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
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)

    if (!fileName || !Number.isFinite(fileSize)) return jsonError('Arquivo inválido.', 400)
    const validationError = validatePersonalDocument({ fileName, fileType, fileSize })
    if (validationError) return jsonError(validationError, 400)

    const filePath = buildPersonalDocumentPath(ownerId, fileName)
    const { data, error } = await createSupabaseServiceClient()
      .storage
      .from(PERSONAL_DOCUMENT_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data?.token) {
      throw error instanceof Error ? error : new Error('Não foi possível preparar o upload.')
    }

    return NextResponse.json({
      bucket: PERSONAL_DOCUMENT_BUCKET,
      path: filePath,
      token: data.token,
    }, { status: 200, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', 401)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível preparar o upload.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PERSONAL_DOCUMENT_CORS_HEADERS })
}
