import { useState } from 'react'
import { ChevronLeft, Heart, MessageCircle, Send } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import type { CommunityPost } from '@/types'

const CATEGORY_LABEL: Record<CommunityPost['category'], string> = {
  duvida: 'Duvida',
  ideia: 'Ideia',
  material: 'Material',
  relato: 'Relato',
}

export default function CommunitySubscreen() {
  const { closeSubscreen } = useNavStore()
  const { userName, communityPosts, addCommunityPost, isCommunityEnabled } = useAppStore()
  const [text, setText] = useState('')
  const [category, setCategory] = useState<CommunityPost['category']>('duvida')

  const enabled = isCommunityEnabled()

  function publish() {
    if (!text.trim()) return
    addCommunityPost({
      id: `cp-${Date.now()}`,
      authorName: userName,
      authorRole: 'Professora',
      text: text.trim(),
      category,
      likes: 0,
      comments: 0,
      createdAt: 'Agora',
    })
    setText('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Comunidade</span>
      </div>

      <div className="scroll-area px-[18px]">
        {!enabled ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-20 h-20 rounded-[24px] flex items-center justify-center text-4xl mb-5" style={{ background: '#D8F3DC' }}>
              🌱
            </div>
            <h2 className="font-serif text-[22px] text-gd mb-2">Comunidade em liberacao gradual</h2>
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
                placeholder="Compartilhe uma duvida, relato ou ideia com outras professoras."
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex items-center gap-2 mt-3">
                <select
                  className="flex-1 rounded-app-sm border border-border px-3 py-2 text-[12px] bg-white"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as CommunityPost['category'])}
                >
                  <option value="duvida">Duvida</option>
                  <option value="ideia">Ideia</option>
                  <option value="material">Material</option>
                  <option value="relato">Relato</option>
                </select>
                <button onClick={publish} className="bg-gm text-white rounded-app-sm px-4 py-2 text-[12px] font-bold flex items-center gap-1">
                  <Send size={13} />
                  Postar
                </button>
              </div>
            </div>

            {communityPosts.map((post) => (
              <article key={post.id} className="bg-white rounded-app border border-border shadow-card p-4 mb-[10px]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-[13px] font-bold text-ink">{post.authorName}</h3>
                    <p className="text-[11px] text-muted">{post.authorRole} · {post.createdAt}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gbg text-gm">
                    {CATEGORY_LABEL[post.category]}
                  </span>
                </div>
                <p className="text-[13px] text-soft leading-[1.6]">{post.text}</p>
                <div className="flex gap-4 mt-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1"><Heart size={13} /> {post.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.comments}</span>
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
