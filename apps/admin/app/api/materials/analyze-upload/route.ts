import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import {
  finalizeMaterialUpload,
  MATERIAL_BUCKET,
  MATERIALS_CORS_HEADERS,
  safeExtension,
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
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const ageRange = String(form.get('ageRange') ?? '').trim()
    const pedagogicalObjective = String(form.get('pedagogicalObjective') ?? '').trim()
    const file = form.get('file')

    if (!title) return jsonError('Informe o tema ou nome do arquivo.', 400)
    if (!description) return jsonError('Informe a descrição do material.', 400)
    if (!(file instanceof File)) return jsonError('Selecione um arquivo para análise.', 400)

    const validationError = validateMaterialFile(file)
    if (validationError) return jsonError(validationError, 400)

    const bytes = Buffer.from(await file.arrayBuffer())
    tempPath = `${ownerId}/tmp/${crypto.randomUUID()}.${safeExtension(file.name)}`
    const supabase = createSupabaseServiceClient()
    const { error: uploadError } = await supabase.storage.from(MATERIAL_BUCKET).upload(tempPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uploadError) throw toError(uploadError, 'Não foi possível fazer upload temporario do material.')

    const result = await finalizeMaterialUpload({ ownerId, title, description, ageRange, pedagogicalObjective, file, bytes, tempPath })
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
      return jsonError('Sessão expirada. Entre novamente.', error.status)
    }
    return jsonError(error instanceof Error ? error.message : 'Não foi possível analisar o material agora.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
