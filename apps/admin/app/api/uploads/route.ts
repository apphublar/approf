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
} from '../materials/material-upload'
import {
  buildPersonalDocumentPath,
  createSignedDownloadUrl,
  PERSONAL_DOCUMENT_BUCKET,
  validatePersonalDocument,
} from '../personal-documents/helpers'

export const runtime = 'nodejs'
export const maxDuration = 60

type UploadModule = 'material_apoio' | 'meus_documentos'

const UPLOAD_CORS_HEADERS = {
  ...MATERIALS_CORS_HEADERS,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: UPLOAD_CORS_HEADERS })
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const debug: UploadDebugItem[] = []
  const setDebug = (id: string, label: string, status: UploadDebugItem['status'], detail?: unknown) => {
    const existing = debug.findIndex((item) => item.id === id)
    const item = { id, label, status, detail, at: new Date().toISOString() }
    if (existing >= 0) debug[existing] = item
    else debug.push(item)
  }

  try {
    setDebug('request', 'Requisicao recebida', 'running', {
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent'),
    })
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    setDebug('auth', 'Usuária autenticada no backend', 'ok', { ownerId })
    const formData = await request.formData()
    const module = String(formData.get('module') ?? '').trim() as UploadModule
    const metadata = parseMetadata(formData.get('metadata'))
    const file = formData.get('file')

    if (!(file instanceof File)) {
      setDebug('file', 'Arquivo recebido no backend', 'error', 'FormData nao contem File')
      return jsonError('Arquivo não recebido pelo servidor.', 400, debug)
    }
    if (module !== 'material_apoio' && module !== 'meus_documentos') {
      setDebug('module', 'Modulo de upload', 'error', { module })
      return jsonError('Modulo de upload inválido.', 400, debug)
    }

    const fileName = file.name || 'arquivo'
    const mimeType = file.type || inferUploadMimeType(fileName)
    const extension = getExtension(fileName)
    const fileSize = file.size
    const bucket = module === 'material_apoio' ? MATERIAL_BUCKET : PERSONAL_DOCUMENT_BUCKET
    const filePath = module === 'material_apoio'
      ? `${ownerId}/${Date.now()}-${safeFileName(fileName)}`
      : buildPersonalDocumentPath(ownerId, fileName)

    setDebug('file', 'Arquivo recebido no backend', 'ok', {
      fileName,
      fileSize,
      mimeType,
      extension,
      module,
    })
    setDebug('storage-path', 'Caminho do Storage', 'ok', { bucket, filePath })

    console.info('[uploads] request received', {
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent'),
      ownerId,
      module,
      fileName,
      fileSize,
      mimeType,
      extension,
      bucket,
      filePath,
      metadata,
    })

    const validationError = module === 'material_apoio'
      ? validateMaterialFile({ name: fileName, type: mimeType, size: fileSize })
      : validatePersonalDocument({ fileName, fileType: mimeType, fileSize })
    if (validationError) {
      setDebug('validation', 'Validacao do arquivo', 'error', validationError)
      return jsonError(validationError, 400, debug)
    }
    setDebug('validation', 'Validacao do arquivo', 'ok')

    const bytes = Buffer.from(await file.arrayBuffer())
    const supabase = createSupabaseServiceClient()
    setDebug('storage', 'Resposta do Storage', 'running', { bucket, filePath, bytes: bytes.byteLength })
    const upload = await supabase.storage.from(bucket).upload(filePath, bytes, {
      contentType: mimeType,
      upsert: false,
    })

    console.info('[uploads] storage upload result', {
      module,
      bucket,
      filePath,
      error: upload.error ? serializeError(upload.error) : null,
      durationMs: Date.now() - startedAt,
    })

    if (upload.error) {
      setDebug('storage', 'Resposta do Storage', 'error', serializeError(upload.error))
      throw toError(upload.error, 'Não foi possível salvar o arquivo no storage.')
    }
    setDebug('storage', 'Resposta do Storage', 'ok', { path: upload.data?.path ?? filePath })

    if (module === 'material_apoio') {
      const title = typeof metadata.title === 'string' ? metadata.title.trim() : ''
      const description = typeof metadata.description === 'string' ? metadata.description.trim() : ''
      const ageRange = typeof metadata.ageRange === 'string' ? metadata.ageRange.trim() : ''
      const pedagogicalObjective = typeof metadata.pedagogicalObjective === 'string' ? metadata.pedagogicalObjective.trim() : ''
      if (!title) {
        setDebug('metadata', 'Dados do material', 'error', 'Título ausente')
        return jsonError('Informe o tema ou nome do arquivo.', 400, debug)
      }
      if (!description) {
        setDebug('metadata', 'Dados do material', 'error', 'Descrição ausente')
        return jsonError('Informe a descrição do material.', 400, debug)
      }
      setDebug('metadata', 'Dados do material', 'ok', { title, descriptionLength: description.length })

      setDebug('database', 'Resposta do banco', 'running', 'Criando registro do material')
      const result = await finalizeMaterialUpload({
        ownerId,
        title,
        description,
        ageRange,
        pedagogicalObjective,
        file: {
          name: fileName,
          type: mimeType,
          size: bytes.byteLength || fileSize,
        },
        bytes,
        tempPath: filePath,
      })

      console.info('[uploads] material record result', {
        materialId: result.payload.materialId,
        status: result.payload.status,
        durationMs: Date.now() - startedAt,
      })
      setDebug('database', 'Resposta do banco', 'ok', {
        materialId: result.payload.materialId,
        status: result.payload.status,
      })

      return NextResponse.json({
        module,
        uploadedVia: 'global-backend',
        filePath,
        debug,
        ...result.payload,
      }, { status: 200, headers: UPLOAD_CORS_HEADERS })
    }

    setDebug('database', 'Resposta do banco', 'running', 'Criando registro do documento')
    const insert = await supabase
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

    console.info('[uploads] personal document insert result', {
      error: insert.error ? serializeError(insert.error) : null,
      id: insert.data?.id,
      durationMs: Date.now() - startedAt,
    })

    if (insert.error) {
      setDebug('database', 'Resposta do banco', 'error', serializeError(insert.error))
      throw toError(insert.error, 'Não foi possível salvar o registro do documento.')
    }
    setDebug('database', 'Resposta do banco', 'ok', { id: insert.data.id, filePath: insert.data.file_path })

    return NextResponse.json({
      module,
      uploadedVia: 'global-backend',
      debug,
      document: {
        id: insert.data.id,
        name: insert.data.file_name,
        title: insert.data.title,
        filePath: insert.data.file_path,
        mimeType: insert.data.mime_type,
        size: insert.data.file_size,
        uploadedAt: insert.data.created_at,
        url: await createSignedDownloadUrl(insert.data.file_path),
      },
    }, { status: 200, headers: UPLOAD_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      setDebug('auth', 'Usuária autenticada no backend', 'error', serializeError(error))
      return jsonError('Sua sessão expirou. Faça login novamente.', error.status, debug)
    }
    setDebug('error', 'Erro completo', 'error', serializeError(error))
    console.error('[uploads] unhandled error', serializeError(error))
    return jsonError(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo. Tente novamente.', 500, debug)
  }
}

interface UploadDebugItem {
  id: string
  label: string
  status: 'running' | 'ok' | 'error'
  detail?: unknown
  at: string
}

function parseMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return {} as Record<string, unknown>
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function inferUploadMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.doc')) return 'application/msword'
  if (lowerName.endsWith('.odt')) return 'application/vnd.oasis.opendocument.text'
  if (lowerName.endsWith('.rtf')) return 'application/rtf'
  if (lowerName.endsWith('.txt')) return 'text/plain'
  return inferMimeType(fileName)
}

function getExtension(fileName: string) {
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : ''
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack }
  if (error && typeof error === 'object') return error
  return { message: String(error) }
}

function jsonError(error: string, status: number, debug?: UploadDebugItem[]) {
  return NextResponse.json({ error, debug: debug ?? [] }, { status, headers: UPLOAD_CORS_HEADERS })
}
