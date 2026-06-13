import type { CommunityComment, CommunityPost, FeatureAccess } from '@/types'
import { getSupabaseClient } from './client'

type CommunityPostRow = {
  id: string
  body: string
  category: string
  likes_count: number
  comments_count: number
  created_at: string
  author_id: string
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null
}

type CommunityCommentRow = {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null
}

const COMMUNITY_POST_SELECT = 'id, body, category, likes_count, comments_count, created_at, author_id'
const COMMUNITY_COMMENT_SELECT = 'id, post_id, author_id, body, created_at'

type ProfileNameRow = { id: string; full_name: string | null }

export async function loadCommunityFeatureAccess(userId: string): Promise<FeatureAccess> {
  const supabase = getSupabaseClient()
  if (!supabase) return { global: false, allowedUserIds: [] }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!error && profile?.role === 'teacher') {
    return { global: true, allowedUserIds: [userId] }
  }

  return { global: false, allowedUserIds: [] }
}

export async function loadCommunityPosts(): Promise<CommunityPost[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const userId = await getCurrentUserId(supabase)
  const { data, error } = await supabase
    .from('community_posts')
    .select(COMMUNITY_POST_SELECT)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw toCommunityError(error, 'Não foi possível carregar as postagens da comunidade.')

  const rows = (data as CommunityPostRow[] | null ?? [])
  const authorNames = await loadAuthorNames(supabase, rows.map((row) => row.author_id))
  const likedPostIds = userId ? await loadLikedPostIds(supabase, userId) : new Set<string>()
  return rows.map((row) => mapCommunityPost(row, likedPostIds, authorNames.get(row.author_id)))
}

export async function loadCommunityComments(postId: string): Promise<CommunityComment[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('community_post_comments')
    .select(COMMUNITY_COMMENT_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw toCommunityError(error, 'Não foi possível carregar os comentários.')
  const rows = (data as CommunityCommentRow[] | null ?? [])
  const authorNames = await loadAuthorNames(supabase, rows.map((row) => row.author_id))
  return rows.map((row) => mapCommunityComment(row, authorNames.get(row.author_id)))
}

export async function createCommunityPost(input: {
  text: string
  category: CommunityPost['category']
  authorName: string
}): Promise<CommunityPost> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const userId = await getCurrentUserId(supabase)
  if (!userId) throw new Error('Sessão não encontrada.')

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: userId,
      body: input.text.trim(),
      category: input.category,
      status: 'published',
    })
    .select(COMMUNITY_POST_SELECT)
    .single()

  if (error) throw toCommunityError(error, 'Não foi possível publicar na comunidade.')
  if (!data) throw new Error('Não foi possível publicar na comunidade.')

  return mapCommunityPost(
    data as CommunityPostRow,
    new Set(),
    input.authorName,
  )
}

export async function toggleCommunityPostLike(postId: string, liked: boolean): Promise<CommunityPost> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const userId = await getCurrentUserId(supabase)
  if (!userId) throw new Error('Sessão não encontrada.')

  if (liked) {
    const { error } = await supabase
      .from('community_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw toCommunityError(error, 'Não foi possível remover a curtida.')
  } else {
    const { error } = await supabase
      .from('community_post_likes')
      .insert({ post_id: postId, user_id: userId })
    if (error) throw toCommunityError(error, 'Não foi possível curtir a postagem.')
  }

  return fetchCommunityPostById(postId, userId)
}

export async function createCommunityComment(input: {
  postId: string
  text: string
  authorName: string
}): Promise<{ comment: CommunityComment; post: CommunityPost }> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const userId = await getCurrentUserId(supabase)
  if (!userId) throw new Error('Sessão não encontrada.')

  const { data, error } = await supabase
    .from('community_post_comments')
    .insert({
      post_id: input.postId,
      author_id: userId,
      body: input.text.trim(),
    })
    .select('id, post_id, author_id, body, created_at')
    .single()

  if (error) throw toCommunityError(error, 'Não foi possível comentar agora.')
  if (!data) throw new Error('Não foi possível comentar agora.')

  const comment = mapCommunityComment(data as CommunityCommentRow, input.authorName)
  const post = await fetchCommunityPostById(input.postId, userId)
  return { comment, post }
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const userId = await getCurrentUserId(supabase)
  if (!userId) throw new Error('Sessão não encontrada.')

  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId)

  if (error) throw toCommunityError(error, 'Não foi possível excluir a postagem.')
}

async function fetchCommunityPostById(postId: string, userId: string): Promise<CommunityPost> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data, error } = await supabase
    .from('community_posts')
    .select(COMMUNITY_POST_SELECT)
    .eq('id', postId)
    .single()

  if (error) throw toCommunityError(error, 'Não foi possível carregar a postagem.')
  const row = data as CommunityPostRow
  const authorNames = await loadAuthorNames(supabase, [row.author_id])
  const likedPostIds = await loadLikedPostIds(supabase, userId)
  return mapCommunityPost(row, likedPostIds, authorNames.get(row.author_id))
}

async function loadAuthorNames(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  authorIds: string[],
) {
  const uniqueIds = Array.from(new Set(authorIds.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, string>()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', uniqueIds)

  if (error) return new Map<string, string>()

  return new Map(
    ((data as ProfileNameRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || 'Professora',
    ]),
  )
}

async function loadLikedPostIds(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string) {
  const { data, error } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .eq('user_id', userId)

  if (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST200') {
      return new Set<string>()
    }
    return new Set<string>()
  }

  return new Set((data ?? []).map((row) => row.post_id as string))
}

async function getCurrentUserId(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>) {
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user?.id) return sessionData.session.user.id

  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}

function mapCommunityPost(
  row: CommunityPostRow,
  likedPostIds: Set<string>,
  authorName?: string | null,
): CommunityPost {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: authorName?.trim() || profile?.full_name?.trim() || 'Professora',
    authorRole: 'Professora',
    text: row.body,
    category: normalizeCategory(row.category),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    likedByMe: likedPostIds.has(row.id),
    createdAt: formatCommunityDate(row.created_at),
  }
}

function mapCommunityComment(row: CommunityCommentRow, authorName?: string | null): CommunityComment {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: authorName?.trim() || profile?.full_name?.trim() || 'Professora',
    text: row.body,
    createdAt: formatCommunityDate(row.created_at),
  }
}

function normalizeCategory(value: string): CommunityPost['category'] {
  if (value === 'duvida' || value === 'ideia' || value === 'material' || value === 'relato') return value
  return 'relato'
}

function formatCommunityDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recente'
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'Agora'
  if (diffMinutes < 60) return `${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function toCommunityError(error: unknown, fallbackMessage: string) {
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; code?: string }
    const message = record.message || record.details || record.hint
    if (message?.includes('more than one relationship was found')) {
      return new Error('Não foi possível carregar os dados da comunidade. Atualize o app e tente novamente.')
    }
    if (message?.includes('row-level security')) {
      return new Error(fallbackMessage)
    }
    if (record.code === 'PGRST116') {
      return new Error('A postagem foi enviada, mas não pôde ser confirmada. Atualize a tela e tente novamente.')
    }
    if (message) return new Error(message)
  }
  if (error instanceof Error) return error
  return new Error(fallbackMessage)
}
