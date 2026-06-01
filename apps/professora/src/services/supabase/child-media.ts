import { getSupabaseClient } from './client'

export interface ChildMediaUploadResult {
  id: string
  name: string
  size: number
  type: string
  isImage: boolean
  storagePath: string
}

export async function uploadChildPortfolioMedia(studentId: string, files: File[]) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nÃ£o estÃ¡ configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('SessÃ£o nÃ£o encontrada.')

  const uploaded: ChildMediaUploadResult[] = []

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = sanitizeFileName(file.name, extension)
    const path = `${ownerId}/${studentId}/portfolio/${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from('child-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (uploadError) throw toError(uploadError, 'NÃ£o foi possÃ­vel enviar a foto privada do portfÃ³lio.')

    const { data: media, error: mediaError } = await supabase
      .from('child_media_assets')
      .insert({
        owner_id: ownerId,
        student_id: studentId,
        storage_bucket: 'child-photos',
        storage_path: path,
        visibility: 'private',
        caption: file.name,
      })
      .select('id')
      .single()

    if (mediaError) throw toError(mediaError, 'Foto enviada, mas nÃ£o foi possÃ­vel registrar no portfÃ³lio.')

    uploaded.push({
      id: media?.id ?? path,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      isImage: isImageFile(file),
      storagePath: path,
    })
  }

  return uploaded
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(apng|avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

function sanitizeFileName(fileName: string, fallbackExtension: string) {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  if (!sanitized) return `arquivo.${fallbackExtension}`
  return sanitized.includes('.') ? sanitized : `${sanitized}.${fallbackExtension}`
}

function toError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallbackMessage)
}
