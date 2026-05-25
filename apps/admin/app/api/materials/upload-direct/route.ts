import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  finalizeMaterialUpload,
  inferMimeType,
  MATERIAL_BUCKET,
  MATERIALS_CORS_HEADERS,
  safeFileName,
  toError,
  validateMaterialFile,
} from '../material-upload'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MATERIALS_CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const formData = await request.formData()
    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const file = formData.get('file')

    if (!title) return jsonError('Informe o tema ou nome do arquivo.', 400)
    if (!description) return jsonError('Informe a descricao do material.', 400)
    if (!(file instanceof File)) return jsonError('Arquivo nao recebido pelo servidor.', 400)

    const fileName = file.name || 'arquivo'
    const fileType = file.type || inferMimeType(fileName)
    const fileSize = file.size
    console.info('[materials/upload-direct] request received', {
      ownerId,
      fileName,
      fileType,
      fileSize,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
    })

    const validationError = validateMaterialFile({ name: fileName, type: fileType, size: fileSize })
    if (validationError) return jsonError(validationError, 400)

    const bytes = Buffer.from(await file.arrayBuffer())
    const tempPath = `${ownerId}/${Date.now()}-${safeFileName(fileName)}`
    const { error: uploadError } = await createSupabaseServiceClient()
      .storage
      .from(MATERIAL_BUCKET)
      .upload(tempPath, bytes, {
        contentType: fileType,
        upsert: false,
      })
    if (uploadError) throw toError(uploadError, 'Nao foi possivel salvar o arquivo no storage.')

    const result = await finalizeMaterialUpload({
      ownerId,
      title,
      description,
      file: {
        name: fileName,
        type: fileType,
        size: bytes.byteLength || fileSize,
      },
      bytes,
      tempPath,
    })

    return NextResponse.json(
      {
        ...result.payload,
        filePath: tempPath,
        uploadedVia: 'backend-direct',
      },
      { status: 200, headers: MATERIALS_CORS_HEADERS },
    )
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessao expirada. Entre novamente.', error.status)
    console.error('[materials/upload-direct] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(toError(error, 'Nao foi possivel enviar o material.').message, 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
