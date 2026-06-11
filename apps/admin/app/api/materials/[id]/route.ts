import { NextResponse } from 'next/server'
import { buildProfessoraCorsHeaders } from '@/app/lib/cors'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { MATERIAL_BUCKET } from '../material-upload'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: buildProfessoraCorsHeaders(request) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const materialId = id?.trim()
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = typeof body.action === 'string' ? body.action : ''

    if (!materialId) return jsonError('ID do material não informado.', 400, corsHeaders)

    const supabase = createSupabaseServiceClient()
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, status, submitted_by, author_id')
      .eq('id', materialId)
      .maybeSingle()

    if (materialError) throw new Error(materialError.message)
    if (!material) return jsonError('Material não encontrado.', 404, corsHeaders)

    const canInteract = material.status === 'published'
      || material.submitted_by === ownerId
      || material.author_id === ownerId
    if (!canInteract) return jsonError('Material indisponível.', 403, corsHeaders)

    if (action === 'view') {
      await incrementMaterialCounter(supabase, materialId, 'views_count')
      await logMaterialAction(supabase, ownerId, 'material_viewed', materialId)
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
    }

    if (action === 'download') {
      await incrementMaterialCounter(supabase, materialId, 'downloads_count')
      await logMaterialAction(supabase, ownerId, 'material_downloaded', materialId)
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
    }

    if (action === 'favorite') {
      const favorite = Boolean(body.favorite)
      if (favorite) {
        const { error } = await supabase
          .from('material_favorites')
          .upsert({ material_id: materialId, owner_id: ownerId }, { onConflict: 'material_id,owner_id' })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('material_favorites')
          .delete()
          .eq('material_id', materialId)
          .eq('owner_id', ownerId)
        if (error) throw new Error(error.message)
      }
      await logMaterialAction(supabase, ownerId, favorite ? 'material_favorited' : 'material_unfavorited', materialId)
      return NextResponse.json({ ok: true, favorite }, { status: 200, headers: corsHeaders })
    }

    if (action === 'rate') {
      const rating = Number(body.rating)
      const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 800) : ''
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return jsonError('Informe uma avaliação de 1 a 5 estrelas.', 400, corsHeaders)
      }
      const { error } = await supabase
        .from('material_ratings')
        .upsert(
          { material_id: materialId, owner_id: ownerId, rating, comment: comment || null },
          { onConflict: 'material_id,owner_id' },
        )
      if (error) throw new Error(error.message)
      await refreshMaterialRatingSummary(supabase, materialId)
      await logMaterialAction(supabase, ownerId, 'material_rated', materialId, { rating })
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
    }

    if (action === 'report') {
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : ''
      const details = typeof body.details === 'string' ? body.details.trim().slice(0, 800) : ''
      if (!reason) return jsonError('Informe o motivo da denuncia.', 400, corsHeaders)
      const { error } = await supabase
        .from('material_reports')
        .upsert(
          { material_id: materialId, reporter_id: ownerId, reason, details: details || null, status: 'open' },
          { onConflict: 'material_id,reporter_id' },
        )
      if (error) throw new Error(error.message)
      const reportsCount = await refreshMaterialReportsSummary(supabase, materialId)
      await logMaterialAction(supabase, ownerId, 'material_reported', materialId, { reason, reportsCount })
      return NextResponse.json({ ok: true, reportsCount }, { status: 200, headers: corsHeaders })
    }

    return jsonError('Ação inválida.', 400, corsHeaders)
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', error.status, corsHeaders)
    console.error('[materials/action] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível atualizar o material.', 500, corsHeaders)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = buildProfessoraCorsHeaders(request)
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const { id } = await params
    const materialId = id?.trim()

    if (!materialId) return jsonError('ID do material não informado.', 400, corsHeaders)

    console.info('[materials/delete] request received', { ownerId, materialId })

    const supabase = createSupabaseServiceClient()

    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('id, file_path, submitted_by, author_id, status')
      .eq('id', materialId)
      .maybeSingle()

    if (fetchError) {
      console.error('[materials/delete] fetch error', fetchError.message)
      throw new Error(fetchError.message)
    }
    if (!material) return jsonError('Material não encontrado.', 404, corsHeaders)

    const isOwner = material.submitted_by === ownerId || material.author_id === ownerId
    if (!isOwner) {
      console.warn('[materials/delete] unauthorized', { ownerId, submitted_by: material.submitted_by, author_id: material.author_id })
      return jsonError('Sem permissao para excluir este material.', 403, corsHeaders)
    }

    console.info('[materials/delete] deleting material', { materialId, status: material.status, filePath: material.file_path })

    const filePath = typeof material.file_path === 'string' ? material.file_path : null
    if (filePath) {
      const { error: storageError } = await supabase.storage.from(MATERIAL_BUCKET).remove([filePath])
      if (storageError) {
        console.warn('[materials/delete] storage removal failed (non-fatal)', storageError.message)
      } else {
        console.info('[materials/delete] storage file removed', { filePath })
      }
    }

    const { error: deleteError } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId)

    if (deleteError) {
      console.error('[materials/delete] DB delete error', deleteError.message)
      throw new Error(deleteError.message)
    }

    console.info('[materials/delete] material deleted successfully', { materialId })
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (error instanceof AiAuthError) return jsonError('Sessão expirada. Entre novamente.', error.status, corsHeaders)
    console.error('[materials/delete] unhandled error', error instanceof Error ? error.message : error)
    return jsonError(error instanceof Error ? error.message : 'Não foi possível excluir o material.', 500, corsHeaders)
  }
}

function jsonError(error: string, status: number, corsHeaders: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: corsHeaders })
}

async function incrementMaterialCounter(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  materialId: string,
  column: 'views_count' | 'downloads_count',
) {
  const { data, error } = await supabase
    .from('materials')
    .select(column)
    .eq('id', materialId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const current = Number((data as Record<string, unknown> | null)?.[column] ?? 0)
  const update = await supabase
    .from('materials')
    .update({ [column]: current + 1 })
    .eq('id', materialId)
  if (update.error) throw new Error(update.error.message)
}

async function refreshMaterialRatingSummary(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  materialId: string,
) {
  const { data, error } = await supabase
    .from('material_ratings')
    .select('rating')
    .eq('material_id', materialId)
  if (error) throw new Error(error.message)
  const ratings = data ?? []
  const ratingsCount = ratings.length
  const averageRating = ratingsCount
    ? Number((ratings.reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / ratingsCount).toFixed(2))
    : 0
  const update = await supabase
    .from('materials')
    .update({ ratings_count: ratingsCount, average_rating: averageRating })
    .eq('id', materialId)
  if (update.error) throw new Error(update.error.message)
}

async function refreshMaterialReportsSummary(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  materialId: string,
) {
  const { data, error } = await supabase
    .from('material_reports')
    .select('id')
    .eq('material_id', materialId)
    .eq('status', 'open')
  if (error) throw new Error(error.message)
  const reportsCount = data?.length ?? 0
  const update: Record<string, unknown> = { reports_count: reportsCount }
  if (reportsCount >= 3) {
    update.status = 'review_required'
    update.ai_analysis_status = 'reported'
    update.auto_hidden_at = new Date().toISOString()
  }
  const result = await supabase
    .from('materials')
    .update(update)
    .eq('id', materialId)
  if (result.error) throw new Error(result.error.message)
  return reportsCount
}

async function logMaterialAction(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  actorId: string,
  action: string,
  materialId: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from('admin_action_logs')
    .insert({
      actor_id: actorId,
      action,
      target_table: 'materials',
      target_id: materialId,
      metadata,
    })
  if (error) {
    console.warn('[materials/action] audit log failed', error.message)
  }
}
