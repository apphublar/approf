import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  MATERIAL_BUCKET,
  MATERIALS_CORS_HEADERS,
  safeExtension,
  validateMaterialFile,
} from '../material-upload'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MATERIALS_CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)

    if (!fileName || !Number.isFinite(fileSize)) {
      return jsonError('Arquivo invalido para upload.', 400)
    }

    const validationError = validateMaterialFile({ name: fileName, type: fileType, size: fileSize })
    if (validationError) return jsonError(validationError, 400)

    const filePath = `${ownerId}/tmp/${crypto.randomUUID()}.${safeExtension(fileName)}`
    const { data, error } = await createSupabaseServiceClient()
      .storage
      .from(MATERIAL_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data?.token) {
      throw error instanceof Error ? error : new Error('Nao foi possivel preparar o upload do arquivo.')
    }

    return NextResponse.json(
      {
        bucket: MATERIAL_BUCKET,
        path: filePath,
        token: data.token,
      },
      { status: 200, headers: MATERIALS_CORS_HEADERS },
    )
  } catch (error) {
    if (error instanceof AiAuthError) {
      return jsonError('Sessao expirada. Entre novamente.', error.status)
    }
    return jsonError(error instanceof Error ? error.message : 'Nao foi possivel preparar o upload do arquivo.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
