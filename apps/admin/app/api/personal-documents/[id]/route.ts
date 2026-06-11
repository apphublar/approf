import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { PERSONAL_DOCUMENT_BUCKET } from '../helpers'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    if (!id) return jsonError('Documento inválido.', 400, corsHeaders)

    const supabase = createSupabaseServiceClient()
    const { data: document, error: loadError } = await supabase
      .from('teacher_personal_documents')
      .select('id, owner_id, file_path')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .single()

    if (loadError || !document) return jsonError('Documento não encontrado.', 404, corsHeaders)

    const { error: storageError } = await supabase.storage
      .from(PERSONAL_DOCUMENT_BUCKET)
      .remove([document.file_path])
    if (storageError) console.warn('[personal-documents] storage delete failed', storageError)

    const { error: deleteError } = await supabase
      .from('teacher_personal_documents')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId)
    if (deleteError) throw toError(deleteError, 'Não foi possível excluir o documento.')

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', 401, corsHeaders)
    if (isMissingPersonalDocumentsTable(error)) {
      return jsonError('Banco de dados ainda não atualizado. Aplique a migration 0021_teacher_personal_documents.sql e recarregue o schema do Supabase.', 503, corsHeaders)
    }
    return jsonError(error instanceof Error ? error.message : 'Não foi possível excluir o documento.', 500, corsHeaders)
  }
}

function jsonError(error: string, status: number, corsHeaders: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: corsHeaders })
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallback)
}

function isMissingPersonalDocumentsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('teacher_personal_documents') && message.includes('schema cache')
}
