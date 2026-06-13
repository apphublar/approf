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
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

type CommunityCommentRow = {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

export async function loadCommunityFeatureAccess(userId: string): Promise<FeatureAccess> {
  const supabase = getSupabaseClient()
  if (!supabase) return { global: false, allowedUserIds: [] }

  const { data: flag, error: flagError } = await supabase
    .from('feature_flags')
    .select('release_mode')
    .eq('key', 'community')
    .maybeSingle()

  if (flagError || !flag) return { global: false, allowedUserIds: [] }
  if (flag.release_mode === 'all') return { global: true, allowedUserIds: [userId] }

  if (flag.release_mode === 'selected') {
    const { data: accessRows, error: accessError } = await supabase
      .from('feature_user_access')
      .select('user_id')
      .eq('feature_key', 'community')

    if (accessError) return { global: false, allowedUserIds: [] }
    return {
      global: false,
      allowedUserIds: (accessRows ?? []).map((row) => row.user_id),
    }
  }

  return { global: false, allowedUserIds: [] }
}

export async function loadCommunityPosts(): Promise<CommunityPost[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const userId = await getCurrentUserId(supabase)
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, body, category, likes_count, comments_count, created_at, author_id, profiles(full_name)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const likedPostIds = userId ? await loadLikedPostIds(supabase, userId) : new Set<string>()
  return (data as CommunityPostRow[] | null ?? []).map((row) => mapCommunityPost(row, likedPostIds))
}

export async function loadCommunityComments(postId: string): Promise<CommunityComment[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('community_post_comments')
    .select('id, post_id, author_id, body, created_at, profiles(full_name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as CommunityCommentRow[] | null ?? []).map(mapCommunityComment)
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
    .select('id, body, category, likes_count, comments_count, created_at, author_id, profiles(full_name)')
    .single()

  if (error) throw error
  return mapCommunityPost({
    ...(data as CommunityPostRow),
    profiles: { full_name: input.authorName },
  }, new Set())
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
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('community_post_likes')
      .insert({ post_id: postId, user_id: userId })
    if (error) throw error
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
    .select('id, post_id, author_id, body, created_at, profiles(full_name)')
    .single()

  if (error) throw error

  const comment = mapCommunityComment({
    ...(data as CommunityCommentRow),
    profiles: { full_name: input.authorName },
  })
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
    .update({ status: 'removed' })
    .eq('id', postId)
    .eq('author_id', userId)

  if (error) throw error
}

async function fetchCommunityPostById(postId: string, userId: string): Promise<CommunityPost> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, body, category, likes_count, comments_count, created_at, author_id, profiles(full_name)')
    .eq('id', postId)
    .single()

  if (error) throw error
  const likedPostIds = await loadLikedPostIds(supabase, userId)
  return mapCommunityPost(data as CommunityPostRow, likedPostIds)
}

async function loadLikedPostIds(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string) {
  const { data, error } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .eq('user_id', userId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.post_id as string))
}

async function getCurrentUserId(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}

function mapCommunityPost(row: CommunityPostRow, likedPostIds: Set<string>): CommunityPost {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: profile?.full_name?.trim() || 'Professora',
    authorRole: 'Professora',
    text: row.body,
    category: normalizeCategory(row.category),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    likedByMe: likedPostIds.has(row.id),
    createdAt: formatCommunityDate(row.created_at),
  }
}

function mapCommunityComment(row: CommunityCommentRow): CommunityComment {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: profile?.full_name?.trim() || 'Professora',
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
