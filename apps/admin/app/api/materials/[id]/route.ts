import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { MATERIAL_BUCKET, MATERIALS_CORS_HEADERS } from '../material-upload'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MATERIALS_CORS_HEADERS })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const materialId = id?.trim()

    if (!materialId) return jsonError('ID do material nao informado.', 400)

    console.info('[materials/delete] request received', { ownerId, materialId })

    const supabase = createSupabaseServiceClient()

    // Fetch the material to verify ownership and get file_path
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('id, file_path, submitted_by, author_id, status')
      .eq('id', materialId)
      .maybeSingle()

    if (fetchError) {
      console.error('[materials/delete] fetch error', fetchError.message)
      throw new Error(fetchError.message)
    }
    if (!material) return jsonError('Material nao encontrado.', 404)

    const isOwner = material.submitted_by === ownerId || material.author_id === ownerId
    if (!isOwner) {
      console.warn('[materials/delete] unauthorized', { ownerId, submitted_by: material.submitted_by, author_id: material.author_id })
      return jsonError('Sem permissao para excluir este material.', 403)
    }

    console.info('[materials/delete] deleting material', { materialId, status: material.status, filePath: material.file_path })

    // Delete file from storage (best-effort)
    const filePath = typeof material.file_path === 'string' ? material.file_path : null
    if (filePath) {
      const { error: storageError } = await supabase.storage.from(MATERIAL_BUCKET).remove([filePath])
      if (storageError) {
        console.warn('[materials/delete] storage removal failed (non-fatal)', storageError.message)
      } else {
        console.info('[materials/delete] storage file removed', { filePath })
      }
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId)

    if (deleteError) {
      console.error('[materials/delete] DB delete error', deleteError.message)
      throw new Error(deleteError.message)
    }

    console.info('[materials/delete] material deleted successfully', { materialId })
    return NextResponse.json({ ok: true }, { status: 200, headers: MATERIALS_CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessao expirada. Entre novamente.', error.status)
    console.error('[materials/delete] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(error instanceof Error ? error.message : 'Nao foi possivel excluir o material.', 500)
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: MATERIALS_CORS_HEADERS })
}
