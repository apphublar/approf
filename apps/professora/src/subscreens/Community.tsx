import { useEffect, useState } from 'react'
import { ChevronLeft, Heart, MessageCircle, Send, Trash2, Users } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  loadCommunityComments,
  toggleCommunityPostLike,
} from '@/services/supabase/community'
import type { CommunityComment, CommunityPost } from '@/types'

const CATEGORY_LABEL: Record<CommunityPost['category'], string> = {
  duvida: 'Dúvida',
  ideia: 'Ideia',
  material: 'Material',
  relato: 'Relato',
}

export default function CommunitySubscreen() {
  const { closeSubscreen } = useNavStore()
  const {
    userId,
    userName,
    communityPosts,
    addCommunityPost,
    updateCommunityPost,
    removeCommunityPost,
    isCommunityEnabled,
  } = useAppStore()

  const [text, setText] = useState('')
  const [category, setCategory] = useState<CommunityPost['category']>('duvida')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [likingPostId, setLikingPostId] = useState<string | null>(null)
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const enabled = isCommunityEnabled()

  async function publish() {
    if (!text.trim() || publishing) return
    setPublishing(true)
    setError('')
    try {
      if (getAppDataMode() === 'supabase') {
        const saved = await createCommunityPost({
          text: text.trim(),
          category,
          authorName: userName,
        })
        addCommunityPost(saved)
      } else {
        addCommunityPost({
          id: `cp-${Date.now()}`,
          authorId: userId,
          authorName: userName,
          authorRole: 'Professora',
          text: text.trim(),
          category,
          likes: 0,
          comments: 0,
          likedByMe: false,
          createdAt: 'Agora',
        })
      }
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar agora.')
    } finally {
      setPublishing(false)
    }
  }

  async function ensureCommentsLoaded(postId: string) {
    if (commentsByPost[postId]) return
    if (getAppDataMode() !== 'supabase') {
      setCommentsByPost((current) => ({ ...current, [postId]: [] }))
      return
    }

    setLoadingComments(postId)
    try {
      const comments = await loadCommunityComments(postId)
      setCommentsByPost((current) => ({ ...current, [postId]: comments }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os comentários.')
    } finally {
      setLoadingComments(null)
    }
  }

  async function toggleComments(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null)
      return
    }
    setExpandedPostId(postId)
    await ensureCommentsLoaded(postId)
  }

  async function handleToggleLike(post: CommunityPost) {
    if (likingPostId) return

    if (getAppDataMode() !== 'supabase') {
      updateCommunityPost({
        ...post,
        likedByMe: !post.likedByMe,
        likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
      })
      return
    }

    setLikingPostId(post.id)
    setError('')
    try {
      const updated = await toggleCommunityPostLike(post.id, post.likedByMe)
      updateCommunityPost(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível curtir a postagem.')
    } finally {
      setLikingPostId(null)
    }
  }

  async function submitComment(post: CommunityPost) {
    const draft = (commentDrafts[post.id] ?? '').trim()
    if (!draft || commentingPostId) return

    if (getAppDataMode() !== 'supabase') {
      const comment: CommunityComment = {
        id: `cc-${Date.now()}`,
        postId: post.id,
        authorId: userId,
        authorName: userName,
        text: draft,
        createdAt: 'Agora',
      }
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: [...(current[post.id] ?? []), comment],
      }))
      updateCommunityPost({ ...post, comments: post.comments + 1 })
      setCommentDrafts((current) => ({ ...current, [post.id]: '' }))
      return
    }

    setCommentingPostId(post.id)
    setError('')
    try {
      const { comment, post: updatedPost } = await createCommunityComment({
        postId: post.id,
        text: draft,
        authorName: userName,
      })
      updateCommunityPost(updatedPost)
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: [...(current[post.id] ?? []), comment],
      }))
      setCommentDrafts((current) => ({ ...current, [post.id]: '' }))
      setExpandedPostId(post.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível comentar agora.')
    } finally {
      setCommentingPostId(null)
    }
  }

  async function handleDeletePost(post: CommunityPost) {
    const confirmed = window.confirm('Deseja excluir esta postagem da comunidade?')
    if (!confirmed || deletingPostId) return

    if (getAppDataMode() !== 'supabase') {
      removeCommunityPost(post.id)
      return
    }

    setDeletingPostId(post.id)
    setError('')
    try {
      await deleteCommunityPost(post.id)
      removeCommunityPost(post.id)
      if (expandedPostId === post.id) setExpandedPostId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a postagem.')
    } finally {
      setDeletingPostId(null)
    }
  }

  useEffect(() => {
    if (!expandedPostId) return
    void ensureCommentsLoaded(expandedPostId)
  }, [expandedPostId])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Comunidade</span>
      </div>

      <div className="scroll-area px-[18px] pb-8">
        {!enabled ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-20 h-20 rounded-[24px] flex items-center justify-center text-gm mb-5" style={{ background: '#D8F3DC' }}>
              <Users size={40} />
            </div>
            <h2 className="font-serif text-[22px] text-gd mb-2">Comunidade em liberação gradual</h2>
            <p className="text-[13px] text-muted leading-[1.7] max-w-[300px]">
              O Super Admin pode liberar para todas as professoras ou apenas para contas selecionadas.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-app border border-border shadow-card p-4 mt-[14px] mb-[14px]">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Nova postagem</p>
              <textarea
                className="w-full min-h-[82px] rounded-app-sm border border-border px-3 py-2 text-[13px] outline-none resize-none"
                placeholder="Compartilhe uma dúvida, relato ou ideia com outras professoras."
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex items-center gap-2 mt-3">
                <select
                  className="flex-1 rounded-app-sm border border-border px-3 py-2 text-[12px] bg-white"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as CommunityPost['category'])}
                >
                  <option value="duvida">Dúvida</option>
                  <option value="ideia">Ideia</option>
                  <option value="material">Material</option>
                  <option value="relato">Relato</option>
                </select>
                <button
                  onClick={() => void publish()}
                  disabled={publishing || !text.trim()}
                  className="bg-gm text-white rounded-app-sm px-4 py-2 text-[12px] font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Send size={13} />
                  {publishing ? 'Publicando...' : 'Postar'}
                </button>
              </div>
            </div>

            {communityPosts.map((post) => {
              const isExpanded = expandedPostId === post.id
              const comments = commentsByPost[post.id] ?? []
              const isAuthor = post.authorId === userId

              return (
                <article key={post.id} className="bg-white rounded-app border border-border shadow-card p-4 mb-[10px]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-bold text-ink">{post.authorName}</h3>
                      <p className="text-[11px] text-muted">{post.authorRole} · {post.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gbg text-gm">
                        {CATEGORY_LABEL[post.category]}
                      </span>
                      {isAuthor && (
                        <button
                          type="button"
                          onClick={() => void handleDeletePost(post)}
                          disabled={deletingPostId === post.id}
                          className="w-8 h-8 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-[#C1440E] disabled:opacity-50"
                          aria-label="Excluir postagem"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[13px] text-soft leading-[1.6]">{post.text}</p>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleLike(post)}
                      disabled={likingPostId === post.id}
                      className={`inline-flex items-center gap-1 rounded-app-sm px-3 py-2 text-[11px] font-bold border ${
                        post.likedByMe
                          ? 'border-gp bg-gbg text-gd'
                          : 'border-border bg-white text-muted'
                      } disabled:opacity-50`}
                    >
                      <Heart size={13} fill={post.likedByMe ? 'currentColor' : 'none'} />
                      {post.likes}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleComments(post.id)}
                      className={`inline-flex items-center gap-1 rounded-app-sm px-3 py-2 text-[11px] font-bold border ${
                        isExpanded
                          ? 'border-gp bg-gbg text-gd'
                          : 'border-border bg-white text-muted'
                      }`}
                    >
                      <MessageCircle size={13} />
                      {post.comments}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-border pt-3">
                      {loadingComments === post.id ? (
                        <p className="text-[11px] text-muted">Carregando comentários...</p>
                      ) : comments.length > 0 ? (
                        <div className="flex flex-col gap-2 mb-3">
                          {comments.map((comment) => (
                            <div key={comment.id} className="rounded-app-sm bg-cream px-3 py-2">
                              <p className="text-[11px] font-bold text-ink">{comment.authorName}</p>
                              <p className="text-[11px] text-muted">{comment.createdAt}</p>
                              <p className="text-[12px] text-soft mt-1 leading-[1.5]">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted mb-3">Nenhum comentário ainda. Seja a primeira a responder.</p>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={commentDrafts[post.id] ?? ''}
                          onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                          placeholder="Escreva um comentário..."
                          className="min-w-0 flex-1 rounded-app-sm border border-border px-3 py-2 text-[12px] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void submitComment(post)}
                          disabled={commentingPostId === post.id || !(commentDrafts[post.id] ?? '').trim()}
                          className="rounded-app-sm bg-gm text-white px-3 py-2 text-[11px] font-bold disabled:opacity-50"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </>
        )}

        {error && (
          <p className="mt-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-[1.5] text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
