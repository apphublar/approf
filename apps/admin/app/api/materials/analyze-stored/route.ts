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

    if (!title) return jsonError('Informe o tema ou nome do arquivo.', 400)
    if (!description) return jsonError('Informe a descricao do material.', 400)
    if (!fileName || !filePath || !Number.isFinite(fileSize)) return jsonError('Arquivo invalido para analise.', 400)
    if (!filePath.startsWith(`${ownerId}/tmp/`)) return jsonError('Arquivo temporario invalido.', 400)

    const materialFile = {
      name: fileName,
      type: fileType || inferMimeType(fileName),
      size: fileSize,
    }
    const validationError = validateMaterialFile(materialFile)
    if (validationError) return jsonError(validationError, 400)

    tempPath = filePath
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.storage.from(MATERIAL_BUCKET).download(filePath)
    if (error || !data) throw toError(error, 'Nao foi possivel ler o arquivo enviado.')

    const bytes = Buffer.from(await data.arrayBuffer())
    const result = await finalizeMaterialUpload({
      ownerId,
      title,
      description,
      file: { ...materialFile, size: bytes.byteLength || fileSize },
      bytes,
      tempPath: filePath,
    })
    tempPath = result.remainingTempPath

    return NextResponse.json(result.payload, { status: 200, headers: MATERIALS_CORS_HEADERS })
  } catch (error) {
    if (tempPath) {
      try {
        await createSupabaseServiceClient().storage.from(MATERIAL_BUCKET).remove([tempPath])
      } catch {
        // Best-effort temporary cleanup.
      }
    }
    if (error instanceof AiAuthError) {
      return jsonError('Sessao expirada. Entre novamente.', error.status)
    }
    return jsonError(error instanceof Error ? error.message : 'Nao foi possivel analisar o material agora.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
