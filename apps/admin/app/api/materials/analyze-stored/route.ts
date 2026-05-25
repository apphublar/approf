import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  finalizeMaterialUpload,
  inferMimeType,
  MATERIAL_BUCKET,
  MATERIALS_CORS_HEADERS,
  toError,
  validateMaterialFile,
} from '../material-upload'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MATERIALS_CORS_HEADERS })
}

export async function POST(request: Request) {
  let tempPath: string | null = null

  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)
    const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''

    console.info('[materials/analyze-stored] request received', { ownerId, fileName, fileType, fileSize, filePath })

    if (!title) return jsonError('Informe o tema ou nome do arquivo.', 400)
    if (!description) return jsonError('Informe a descricao do material.', 400)
    if (!fileName || !filePath || !Number.isFinite(fileSize)) {
      console.warn('[materials/analyze-stored] invalid file params', { fileName, filePath, fileSize })
      return jsonError('Arquivo invalido para analise.', 400)
    }
    if (!filePath.startsWith(`${ownerId}/`)) {
      console.warn('[materials/analyze-stored] filePath does not belong to user', { filePath, ownerId })
      return jsonError('Arquivo temporario invalido.', 400)
    }

    const materialFile = {
      name: fileName,
      type: fileType || inferMimeType(fileName),
      size: fileSize,
    }
    const validationError = validateMaterialFile(materialFile)
    if (validationError) {
      console.warn('[materials/analyze-stored] file validation failed', { validationError })
      return jsonError(validationError, 400)
    }

    tempPath = filePath
    const supabase = createSupabaseServiceClient()

    console.info('[materials/analyze-stored] step 1 — downloading file from storage', { filePath })
    const { data, error } = await supabase.storage.from(MATERIAL_BUCKET).download(filePath)
    if (error || !data) {
      console.error('[materials/analyze-stored] step 1 FAILED — storage download error', {
        message: error?.message,
        filePath,
      })
      throw toError(error, 'Nao foi possivel ler o arquivo enviado. Verifique se o upload ao storage foi concluido.')
    }

    const bytes = Buffer.from(await data.arrayBuffer())
    console.info('[materials/analyze-stored] step 1 — file downloaded', { filePath, byteLength: bytes.byteLength })

    console.info('[materials/analyze-stored] step 2 — starting finalize (DB insert + AI)', { ownerId, fileName })
    const result = await finalizeMaterialUpload({
      ownerId,
      title,
      description,
      file: { ...materialFile, size: bytes.byteLength || fileSize },
      bytes,
      tempPath: filePath,
    })
    tempPath = result.remainingTempPath

    console.info('[materials/analyze-stored] step 2 — finalize complete', {
      materialId: result.payload.materialId,
      status: result.payload.status,
    })

    return NextResponse.json(result.payload, { status: 200, headers: MATERIALS_CORS_HEADERS })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel analisar o material agora.'
    console.error('[materials/analyze-stored] unhandled error', { errorMessage, tempPath })

    if (tempPath) {
      try {
        console.info('[materials/analyze-stored] cleaning up storage file after error', { tempPath })
        await createSupabaseServiceClient().storage.from(MATERIAL_BUCKET).remove([tempPath])
      } catch (cleanupError) {
        console.warn('[materials/analyze-stored] cleanup failed (non-fatal)', cleanupError instanceof Error ? cleanupError.message : cleanupError)
      }
    }
    if (error instanceof AiAuthError) {
      return jsonError('Sessao expirada. Entre novamente.', error.status)
    }
    return jsonError(errorMessage, 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
