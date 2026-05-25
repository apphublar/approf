import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  MATERIAL_BUCKET,
  MATERIALS_CORS_HEADERS,
  safeFileName,
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

    console.info('[materials/upload-url] request received', { ownerId, fileName, fileType, fileSize })

    if (!fileName || !Number.isFinite(fileSize)) {
      console.warn('[materials/upload-url] invalid file params', { fileName, fileSize })
      return jsonError('Arquivo inválido para upload.', 400)
    }

    const validationError = validateMaterialFile({ name: fileName, type: fileType, size: fileSize })
    if (validationError) {
      console.warn('[materials/upload-url] file validation failed', { validationError })
      return jsonError(validationError, 400)
    }

    const filePath = `${ownerId}/${Date.now()}-${safeFileName(fileName)}`
    console.info('[materials/upload-url] generating signed upload URL', { bucket: MATERIAL_BUCKET, filePath })

    const supabase = createSupabaseServiceClient()

    // Verify bucket exists before attempting signed URL
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) {
      console.error('[materials/upload-url] failed to list buckets', bucketsError.message)
    } else {
      const bucketExists = buckets?.some((b) => b.id === MATERIAL_BUCKET)
      if (!bucketExists) {
        console.error('[materials/upload-url] bucket not found', { MATERIAL_BUCKET, available: buckets?.map((b) => b.id) })
        return jsonError(`Bucket de storage "${MATERIAL_BUCKET}" não encontrado. Verifique se a migration 0020 foi aplicada.`, 500)
      }
      console.info('[materials/upload-url] bucket confirmed', { MATERIAL_BUCKET })
    }

    const { data, error } = await supabase
      .storage
      .from(MATERIAL_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('[materials/upload-url] createSignedUploadUrl error', {
        message: error.message,
        status: (error as { status?: number }).status,
      })
      throw new Error(error.message || 'Não foi possível preparar o upload do arquivo.')
    }

    if (!data?.token) {
      console.error('[materials/upload-url] signed URL returned no token', { data })
      throw new Error('Não foi possível preparar o upload do arquivo.')
    }

    console.info('[materials/upload-url] signed URL created successfully', { filePath, hasToken: true })

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
      return jsonError('Sessão expirada. Entre novamente.', error.status)
    }
    console.error('[materials/upload-url] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível preparar o upload do arquivo.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
