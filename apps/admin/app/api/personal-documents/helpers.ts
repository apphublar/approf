import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export const PERSONAL_DOCUMENT_BUCKET = 'teacher-documents'

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function validatePersonalDocument(input: { fileName: string; fileType: string; fileSize: number }) {
  const lowerName = input.fileName.toLowerCase()
  const mimeType = input.fileType.toLowerCase()
  const allowed = ALLOWED_IMAGE_TYPES.includes(mimeType)
    || mimeType === 'application/pdf'
    || ['.jpg', '.jpeg', '.png', '.webp'].some((extension) => lowerName.endsWith(extension))
    || ALLOWED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  if (!allowed) return 'Arquivo não permitido. Envie PDF, DOCX, XLSX, PPTX, JPG, PNG ou WEBP.'
  if (input.fileSize > MAX_FILE_SIZE_BYTES) return 'Arquivo muito grande. Use arquivos de até 15 MB.'
  return ''
}

export function buildPersonalDocumentPath(ownerId: string, fileName: string) {
  return `${ownerId}/${Date.now()}-${safeFileName(fileName)}`
}

export async function createSignedDownloadUrl(filePath: string) {
  const { data } = await createSupabaseServiceClient()
    .storage
    .from(PERSONAL_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60 * 10)
  return data?.signedUrl ?? null
}

export function safeFileName(fileName: string) {
  const normalized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const extension = normalized.split('.').pop()?.replace(/[^a-z0-9]/g, '') || 'bin'
  const base = normalized
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'arquivo'
  return `${base}.${extension}`
}
