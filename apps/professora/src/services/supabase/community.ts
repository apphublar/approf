import type { CommunityPost, FeatureAccess } from '@/types'
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

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, body, category, likes_count, comments_count, created_at, author_id, profiles(full_name)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data as CommunityPostRow[] | null ?? []).map(mapCommunityPost)
}

export async function createCommunityPost(input: {
  text: string
  category: CommunityPost['category']
  authorName: string
}): Promise<CommunityPost> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
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
  })
}

function mapCommunityPost(row: CommunityPostRow): CommunityPost {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    authorName: profile?.full_name?.trim() || 'Professora',
    authorRole: 'Professora',
    text: row.body,
    category: normalizeCategory(row.category),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
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
