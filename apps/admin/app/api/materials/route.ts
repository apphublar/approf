import { NextResponse } from 'next/server'
import { AiAuthError, createSupabaseServiceClient, getAuthenticatedUserId } from '@/app/lib/supabase-server'
import { MATERIAL_BUCKET } from './material-upload'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  try {
    const ownerId = await getAuthenticatedUserId(request.headers.get('authorization'))
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('materials')
      .select('id, title, description, type, age_range, pedagogical_objective, file_path, file_name, file_type, file_size_bytes, mime_type, status, ai_analysis_status, detected_category, content_preview, published_at, submitted_by, author_id, author_name, author_avatar, downloads_count, views_count, ratings_count, average_rating, reports_count, created_at')
      .or(`status.eq.published,submitted_by.eq.${ownerId}`)
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) throw toError(error, 'Nao foi possivel listar os materiais de apoio.')

    const materialIds = (data ?? []).map((item) => item.id).filter(Boolean)
    const [favoritesResult, ratingsResult] = materialIds.length
      ? await Promise.all([
        supabase
          .from('material_favorites')
          .select('material_id')
          .eq('owner_id', ownerId)
          .in('material_id', materialIds),
        supabase
          .from('material_ratings')
          .select('material_id, rating, comment')
          .eq('owner_id', ownerId)
          .in('material_id', materialIds),
      ])
      : [{ data: [] }, { data: [] }]

    const favoriteIds = new Set((favoritesResult.data ?? []).map((item) => item.material_id))
    const ratingByMaterial = new Map(
      (ratingsResult.data ?? []).map((item) => [
        item.material_id,
        { rating: item.rating as number, comment: item.comment as string | null },
      ]),
    )

    const materials = await Promise.all((data ?? []).map(async (item) => {
      const filePath = typeof item.file_path === 'string' ? item.file_path : ''
      let downloadUrl: string | null = null
      if (filePath) {
        const signed = await supabase.storage.from(MATERIAL_BUCKET).createSignedUrl(filePath, 60 * 10)
        downloadUrl = signed.data?.signedUrl ?? null
      }
      const { file_path: _filePath, submitted_by: _submittedBy, created_at: _createdAt, ...safeItem } = item
      const myRating = ratingByMaterial.get(item.id)
      return {
        ...safeItem,
        downloadUrl,
        is_favorite: favoriteIds.has(item.id),
        my_rating: myRating?.rating ?? null,
        my_rating_comment: myRating?.comment ?? null,
      }
    }))

    return NextResponse.json({ materials }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AiAuthError) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401, headers: CORS_HEADERS })
    }
    console.error('[materials/list] erro interno', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nao foi possivel listar os materiais de apoio.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
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
