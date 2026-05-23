import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  FolderClosed,
  Hourglass,
  Lightbulb,
  Menu,
  MoreVertical,
  NotebookPen,
  PenLine,
  Pencil,
  School,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { toTitleCaseName } from '@/utils/text'
import type { BoardNote } from '@/types'
import AnnotationCard from '@/components/ui/AnnotationCard'
import { getAiUsageSummary, type AiUsageSummary } from '@/services/ai-usage'

const QUICK_ACCESS = [
  { label: 'Anotações', desc: 'Registre o dia a dia da turma', icon: NotebookPen, bg: '#D8F3DC', tab: 'annotations' as const, sub: null },
  { label: 'Minhas Turmas', desc: 'Alunos, perfis e progressos', icon: School, bg: '#FFF3CD', tab: 'classes' as const, sub: null },
  { label: 'Calendário', desc: 'Eventos e tarefas pedagógicas', icon: CalendarDays, bg: '#E3D5F5', tab: null, sub: 'calendar' as const },
  { label: 'Comunidade', desc: 'Troque ideias com professoras', icon: Users, bg: '#D8F3DC', tab: null, sub: 'community' as const },
  { label: 'Conquistas', desc: 'Acompanhe sua evolução', icon: Trophy, bg: '#FFF3CD', tab: 'achievements' as const, sub: null },
  { label: 'Documentos', desc: 'Arquivos pessoais com segurança', icon: FolderClosed, bg: '#D0E8FF', tab: null, sub: 'documents' as const },
] as const

export default function HomeScreen() {
  const { userName, annotations, boardNotes, classes } = useAppStore()
  const { setTab, openSubscreen, activeTab, subscreens } = useNavStore()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [modalNote, setModalNote] = useState<BoardNote | null | 'new'>('new')
  const [modalOpen, setModalOpen] = useState(false)
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null)
  const touchStartX = useRef(0)

  const firstName = getDisplayFirstName(userName)
  const recentNotes = annotations.slice(0, 3)
  const weeklySummary = useMemo(() => buildWeeklySummary(annotations, classes), [annotations, classes])
  const studentsWithoutRecentNotes = useMemo(
    () => buildStudentsWithoutRecentNotes(annotations, classes).slice(0, 3),
    [annotations, classes],
  )
  const giztokensRemaining = aiUsage?.wallet.giztokensRemaining ?? 8000
  const docsGenerated = aiUsage?.generatedDocumentsThisMonth ?? aiUsage?.generatedThisMonth ?? 0
  const imagesGenerated = aiUsage?.generatedImagesThisMonth ?? 0

  const allSlides: ({ isMain: true } | { isMain: false; note: BoardNote })[] = [
    { isMain: true },
    ...boardNotes.map((n): { isMain: false; note: BoardNote } => ({ isMain: false, note: n })),
  ]

  // Clamp slide index synchronously to avoid white flash.
  const safeSlide = Math.min(currentSlide, allSlides.length - 1)

  // Keep state in sync (silent, no flash)
  useEffect(() => {
    if (currentSlide !== safeSlide) setCurrentSlide(safeSlide)
  }, [safeSlide, currentSlide])

  useEffect(() => {
    if (activeTab !== 'home') return

    let active = true
    getAiUsageSummary()
      .then((summary) => {
        if (active) setAiUsage(summary)
      })
      .catch(() => {
        if (active) setAiUsage(null)
      })
    return () => {
      active = false
    }
  }, [activeTab, subscreens.length])

  function handleQuickAccess(tab: typeof QUICK_ACCESS[number]['tab'], sub: typeof QUICK_ACCESS[number]['sub']) {
    if (tab) setTab(tab)
    else if (sub) openSubscreen(sub)
  }

  // Current note being viewed (null if on main slide)
  const currentViewedNote: BoardNote | null =
    !allSlides[safeSlide]?.isMain
      ? (allSlides[safeSlide] as { isMain: false; note: BoardNote }).note
      : null

  const [noteMenuOpen, setNoteMenuOpen] = useState(false)

  function openNewNoteModal() {
    setNoteMenuOpen(false)
    setModalNote('new')
    setModalOpen(true)
  }

  function openEditModal(note: BoardNote) {
    setNoteMenuOpen(false)
    setModalNote(note)
    setModalOpen(true)
  }

  function deleteCurrentNote() {
    if (!currentViewedNote) return
    setNoteMenuOpen(false)
    // Go back to previous slide before deleting to avoid empty frame
    setCurrentSlide((s) => Math.max(0, s - 1))
    useAppStore.getState().deleteBoardNote(currentViewedNote.id)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta > 48 && currentSlide > 0) setCurrentSlide((s) => s - 1)
    else if (delta < -48 && currentSlide < allSlides.length - 1) setCurrentSlide((s) => s + 1)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board */}
      <div
        className="chalk-bg flex-shrink-0 relative border-b-4 border-[#142B1E] overflow-hidden"
        style={{ backgroundColor: '#1B4332' }}
      >
        {/* Slides wrapper */}
        <div
          className="flex"
          style={{ transform: `translateX(-${safeSlide * 100}%)`, transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {allSlides.map((slide, i) => (
            <div key={i} className="min-w-full px-5 pt-12 pb-6 relative">
              {slide.isMain ? (
                <MainSlide
                  name={firstName}
                  annotations={annotations.length}
                  giztokens={giztokensRemaining}
                  documents={docsGenerated}
                  images={imagesGenerated}
                  onOpenGizTokens={() => openSubscreen('giztokens')}
                  onOpenAnnotations={() => setTab('annotations')}
                  onOpenDocuments={() => openSubscreen('generated-documents', { kind: 'documents' })}
                  onOpenImages={() => openSubscreen('generated-documents', { kind: 'images' })}
                />
              ) : (
                <NoteSlide note={slide.note} />
              )}
            </div>
          ))}
        </div>

        {/* Top-right actions â€” always same size, same row */}
        <div className="absolute top-3 right-4 z-10 flex items-center gap-[10px]">
          <button
            onClick={() => openSubscreen('teacher-account')}
            className="rounded-full border-none flex items-center justify-center"
            style={{
              width: 36, height: 36,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
            aria-label="Abrir menu de conta"
          >
            <Menu size={17} />
          </button>

          {/* Note options only when viewing note slide */}
          {currentViewedNote && (
            <div className="relative">
              <button
                onClick={() => setNoteMenuOpen((v) => !v)}
                className="rounded-full border-none flex items-center justify-center"
                style={{
                  width: 36, height: 36,
                  background: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.80)',
                }}
              >
                <MoreVertical size={17} />
              </button>

              {noteMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[50]" onClick={() => setNoteMenuOpen(false)} />
                  <div
                    className="absolute top-[42px] right-0 z-[51] rounded-[12px] overflow-hidden shadow-md"
                    style={{ background: 'rgba(255,255,255,0.97)', minWidth: 148, backdropFilter: 'blur(8px)' }}
                  >
                    <button
                      onClick={() => openEditModal(currentViewedNote)}
                      className="w-full flex items-center gap-[10px] px-4 py-[12px] border-none bg-transparent cursor-pointer"
                      style={{ color: '#1B4332', fontSize: 14, fontWeight: 600, fontFamily: '"DM Sans",sans-serif' }}
                    >
                      <Pencil size={15} color="#4F8341" /> Editar
                    </button>
                    <div className="h-px mx-3" style={{ background: '#D4EBC8' }} />
                    <button
                      onClick={deleteCurrentNote}
                      className="w-full flex items-center gap-[10px] px-4 py-[12px] border-none bg-transparent cursor-pointer"
                      style={{ color: '#C1440E', fontSize: 14, fontWeight: 600, fontFamily: '"DM Sans",sans-serif' }}
                    >
                      <Trash2 size={15} color="#C1440E" /> Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add new note */}
          <button
            onClick={openNewNoteModal}
            className="rounded-full border-none flex items-center justify-center"
            style={{
              width: 36, height: 36,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          >
            <PenLine size={17} style={{ transform: 'rotate(12deg)' }} />
          </button>
        </div>

        {/* Slide dots */}
        {allSlides.length > 1 && (
          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex gap-[5px] z-10">
            {allSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className="h-[5px] rounded-full transition-all duration-200 cursor-pointer border-none p-0"
                style={{
                  width: i === safeSlide ? 14 : 5,
                  background: i === safeSlide ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="scroll-area">
        <div className="px-[18px]">
          <button
            onClick={() => openSubscreen('interventions')}
            className="subtle-attention w-full rounded-app p-4 mt-[14px] mb-[11px] border-none text-left text-white shadow-card active:scale-[.98] transition-transform"
            style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[12px] bg-white/20 flex items-center justify-center">
                <Lightbulb size={21} />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold">Intervenções</h3>
                <p className="text-[12px] opacity-90 leading-snug">Receba sugestões pedagógicas</p>
              </div>
              <ChevronRight size={18} className="text-white/80" />
            </div>
          </button>

          <button
            onClick={() => openSubscreen('ai')}
            className="subtle-attention w-full rounded-app p-4 mb-[11px] border-none text-left text-white shadow-card active:scale-[.98] transition-transform"
            style={{ background: 'linear-gradient(135deg,#4F8341,#83C451)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[12px] bg-white/15 flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold">Planejamentos e Relatórios</h3>
                <p className="text-[12px] opacity-80 leading-snug">Planeje a rotina e documente o percurso</p>
              </div>
              <ChevronRight size={18} className="text-white/70" />
            </div>
          </button>

          <div className="bg-white rounded-app p-4 mb-[14px] border border-border shadow-card">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">
              Sugestões pedagógicas
            </p>
            <button
              onClick={() => openSubscreen('ai')}
              className="w-full flex items-center gap-3 text-left bg-transparent border-none"
            >
              <div className="w-9 h-9 rounded-[11px] flex items-center justify-center" style={{ background: '#FFF3CD' }}>
                <Sparkles size={17} color="#856404" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-ink">3 relatórios pendentes</p>
                <p className="text-[11px] text-muted leading-snug">Lucas, Sofia e Valentina já têm anotações suficientes.</p>
              </div>
            </button>
          </div>

          <button
            onClick={() => openSubscreen('calendar')}
            className="w-full bg-white rounded-app p-4 mb-[14px] border border-border shadow-card flex items-center gap-3 text-left active:scale-[.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: '#E3D5F5', color: '#6930C3' }}>
              <CalendarDays size={19} />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-ink">Datas próximas</h3>
              <p className="text-[12px] text-muted">Reunião de pais e fechamento de relatórios</p>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>

          <section className="bg-white rounded-app p-4 mb-[14px] border border-border shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Resumo semanal</p>
                <p className="text-[13px] font-bold text-ink mt-1">{weeklySummary.title}</p>
              </div>
              <button
                onClick={() => setTab('annotations')}
                className="text-[11px] font-bold text-gm"
              >
                Ver anotações
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[11px] text-muted leading-[1.45]">
              <p>- {weeklySummary.totalNotes} registros nos últimos 7 dias.</p>
              <p>- Categoria em destaque: {weeklySummary.topCategory}.</p>
              <p>- Crianças sem registro recente: {weeklySummary.studentsWithoutRecentNote}.</p>
              {weeklySummary.topStudent && <p>- Maior volume de registros: {weeklySummary.topStudent}.</p>}
            </div>
          </section>

          <section className="bg-white rounded-app p-4 mb-[14px] border border-border shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Detector sem registro</p>
                <p className="text-[13px] font-bold text-ink mt-1">
                  {studentsWithoutRecentNotes.length
                    ? `${studentsWithoutRecentNotes.length} crianças sem anotação recente`
                    : 'Nenhuma criança sem registro recente'}
                </p>
              </div>
              <button
                onClick={() => setTab('annotations')}
                className="text-[11px] font-bold text-gm"
              >
                Ir para anotações
              </button>
            </div>
            {studentsWithoutRecentNotes.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {studentsWithoutRecentNotes.map((item) => (
                  <button
                    key={item.studentId}
                    onClick={() => openSubscreen('new-annotation', {
                      prefill: {
                        workKind: 'memory',
                        modelId: 'observacao',
                        classId: item.classId,
                        studentId: item.studentId,
                        text: `Observacao de acompanhamento para ${item.studentName} (${item.className}): `,
                      },
                    })}
                    className="w-full rounded-app-sm border border-border bg-cream px-3 py-3 text-left active:scale-[.98] transition-transform"
                  >
                    <p className="text-[12px] font-bold text-ink">{item.studentName}</p>
                    <p className="text-[11px] text-muted mt-1">Turma {item.className} - sem registro nos últimos 7 dias</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted leading-[1.5]">
                Continue mantendo registros recorrentes para alimentar relatórios e planejamentos com dados atualizados.
              </p>
            )}
          </section>

          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mt-[18px] mb-[10px]">
            Acesso rápido
          </p>
          <div className="flex flex-col gap-[11px]">
            {QUICK_ACCESS.filter((item) => item.tab !== 'achievements').map((item) => (
              <button
                key={item.label}
                onClick={() => handleQuickAccess(item.tab, item.sub)}
                className="bg-white rounded-app px-[15px] py-[15px] cursor-pointer border border-border shadow-card flex items-center gap-[13px] active:scale-[.98] transition-transform text-left"
              >
                <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center text-gm flex-shrink-0" style={{ background: item.bg }}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-ink">{item.label}</h3>
                  <p className="text-[12px] text-muted leading-snug">{item.desc}</p>
                </div>
                <ChevronRight size={18} className="text-muted flex-shrink-0" />
              </button>
            ))}
          </div>

          <button
            onClick={() => setTab('materials')}
            className="w-full bg-white rounded-app px-[15px] py-[15px] cursor-pointer border border-border shadow-card flex items-center gap-[13px] mt-[11px] mb-[22px] active:scale-[.98] transition-transform"
          >
            <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center text-gm flex-shrink-0" style={{ background: '#D8F3DC' }}>
              <BookOpen size={21} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-[14px] font-bold text-ink">Material de Apoio</h3>
              <p className="text-[12px] text-muted">Modelos editáveis prontos para usar</p>
            </div>
            <ChevronRight size={18} className="text-muted flex-shrink-0" />
          </button>

          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
            Anotações recentes
          </p>
        </div>

        <div className="px-[18px]">
          {recentNotes.map((ann) => (
            <AnnotationCard
              key={ann.id}
              annotation={ann}
              onClick={() => openSubscreen('new-annotation', { annotationId: ann.id })}
            />
          ))}
        </div>
      </div>

      {/* Board note modal */}
      {modalOpen && (
        <BoardNoteModal
          initialNote={modalNote === 'new' ? null : modalNote}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

/* MainSlide */
function MainSlide({
  name,
  annotations,
  giztokens,
  documents,
  images,
  onOpenGizTokens,
  onOpenAnnotations,
  onOpenDocuments,
  onOpenImages,
}: {
  name: string
  annotations: number
  giztokens: number
  documents: number
  images: number
  onOpenGizTokens: () => void
  onOpenAnnotations: () => void
  onOpenDocuments: () => void
  onOpenImages: () => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const stats = [
    { n: formatFullNumber(giztokens), l: 'GizTokens', onClick: onOpenGizTokens },
    { n: formatCompactNumber(annotations), l: 'Anotações', onClick: onOpenAnnotations },
    { n: formatCompactNumber(documents), l: 'Documentos', onClick: onOpenDocuments },
    { n: formatCompactNumber(images), l: 'Imagens', onClick: onOpenImages },
  ]
  return (
    <div className="relative z-10">
      <p className="font-chalk text-base" style={{ color: 'rgba(255,255,255,0.55)' }}>{greeting},</p>
      <h1 className="font-chalk text-white text-[34px] font-bold leading-[1.05] mb-[5px] break-words pr-12">{name}</h1>
      <div className="w-[52%] h-[2px] rounded-sm mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
      <div className="grid grid-cols-4 gap-[7px]">
        {stats.map((s) => (
          <button
            key={s.l}
            onClick={s.onClick}
            className="rounded-xl p-[8px] text-center active:scale-[.98] transition-transform"
            style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <span className="block text-[17px] font-bold text-white leading-none">{s.n}</span>
            <span className="block text-[9px] mt-[5px] leading-tight" style={{ color: 'rgba(255,255,255,0.64)' }}>{s.l}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* NoteSlide without local action buttons. */
function NoteSlide({ note }: { note: BoardNote }) {
  return (
    <div className="relative z-10 pr-4">
      {note.chalk ? (
        <>
          <p className="font-chalk text-white text-2xl font-bold leading-tight">{note.title}</p>
          {note.body && <p className="font-chalk text-lg leading-[1.5] mt-1" style={{ color: 'rgba(255,255,255,0.80)' }}>{note.body}</p>}
        </>
      ) : (
        <>
          <p className="text-[15px] font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{note.title}</p>
          {note.body && <p className="text-[13px] leading-[1.6] mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{note.body}</p>}
        </>
      )}
      {note.expiresAt && (
        <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
          <Hourglass size={13} /> Expira em {formatDate(note.expiresAt)}
        </p>
      )}
    </div>
  )
}

/* BoardNoteModal - add or edit note. */
function BoardNoteModal({
  initialNote,
  onClose,
}: {
  initialNote: BoardNote | null
  onClose: () => void
}) {
  const { addBoardNote, deleteBoardNote } = useAppStore()

  const [title, setTitle]   = useState(initialNote?.title   ?? '')
  const [body, setBody]     = useState(initialNote?.body    ?? '')
  const [expires, setExpires] = useState(initialNote?.expiresAt ?? '')
  const [chalk, setChalk]   = useState(initialNote?.chalk   ?? true)

  const isEditing = initialNote !== null

  /* drag-to-close */
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY]   = useState(0)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return
    const delta = e.clientY - dragStartY.current
    if (delta > 0) setDragY(delta)
  }
  function onPointerUp() {
    if (dragY > 90) onClose()
    else setDragY(0)
    dragStartY.current = null
  }

  function save() {
    if (!title.trim() && !body.trim()) return alert('Escreva algo antes de salvar.')
    if (isEditing) deleteBoardNote(initialNote.id)
    addBoardNote({
      id: `bn-${Date.now()}`,
      title: title || 'Nota',
      body,
      chalk,
      expiresAt: expires || null,
    })
    onClose()
  }

  const previewTitle = title || 'Título da nota'
  const previewBody = body || 'Sua nota aparece aqui...'

  const appRoot = document.getElementById('app-root')
  if (!appRoot) return null

  return createPortal(
    <div
      className="absolute inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-[22px] w-full max-w-[430px] bottom-sheet"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragY > 0 ? 'none' : 'transform 0.28s ease',
        }}
      >
        {/* Drag handle */}
        <div
          className="pt-[10px] pb-2 px-[18px] cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="w-[38px] h-1 bg-border rounded-sm mx-auto" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 32px)' }}>
          <div className="px-[18px] pb-10">
            <p className="text-[15px] font-bold mb-[14px]">
              {isEditing ? 'Editar nota' : 'Nova nota no quadro'}
            </p>

            {/* Preview */}
            <div className="rounded-xl p-4 mb-[14px] min-h-[76px]" style={{ background: '#1B4332' }}>
              {chalk ? (
                <p className="font-chalk text-white text-[19px] leading-[1.5]">
                  <strong>{previewTitle}</strong><br />{previewBody}
                </p>
              ) : (
                <p className="text-[14px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.90)' }}>
                  <strong>{previewTitle}</strong><br />{previewBody}
                </p>
              )}
            </div>

            {/* Style toggle */}
            <div className="flex gap-[7px] mb-3">
              {[{ v: true, label: 'Fonte giz' }, { v: false, label: 'Fonte normal' }].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => setChalk(opt.v)}
                  className="flex-1 py-2 rounded-app-sm text-xs font-semibold cursor-pointer"
                  style={{
                    border: `1.5px solid ${chalk === opt.v ? '#4F8341' : '#D4EBC8'}`,
                    background: chalk === opt.v ? '#F0FAF4' : '#fff',
                    color: chalk === opt.v ? '#4F8341' : '#9A9A9A',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              className="w-full px-3 py-[10px] rounded-app-sm text-sm text-ink outline-none mb-2"
              style={{ fontFamily: '"DM Sans",sans-serif', border: '1.5px solid #D4EBC8' }}
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#83C451')}
              onBlur={(e) => (e.target.style.borderColor = '#D4EBC8')}
            />
            <textarea
              className="w-full min-h-[80px] px-3 py-[10px] rounded-app-sm text-sm text-ink outline-none resize-none leading-[1.6] mb-2"
              style={{ fontFamily: '"DM Sans",sans-serif', border: '1.5px solid #D4EBC8' }}
              placeholder="Escreva sua nota..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#83C451')}
              onBlur={(e) => (e.target.style.borderColor = '#D4EBC8')}
            />

            <label className="block text-[11px] text-muted mb-[5px]">Data de expiração (opcional)</label>
            <input
              type="date"
              className="w-full px-3 py-[10px] rounded-app-sm text-sm text-ink outline-none mb-4"
              style={{ fontFamily: '"DM Sans",sans-serif', border: '1.5px solid #D4EBC8' }}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = '#83C451')}
              onBlur={(e) => (e.target.style.borderColor = '#D4EBC8')}
            />

            <button
              onClick={save}
              className="w-full py-[14px] rounded-app-sm text-white font-bold text-[15px] border-none cursor-pointer mb-2"
              style={{ background: '#83C451' }}
            >
              {isEditing ? 'Salvar alterações' : 'Adicionar ao quadro'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    appRoot
  )
}

function formatDate(s: string) {
  const [y, m, d] = s.split('-')
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

function getDisplayFirstName(name: string) {
  const cleaned = name
    .replace(/prof\.?\s*(ª|a|o)?/i, '')
    .replace(/prof\.?\s*/i, '')
    .trim()

  const firstName = toTitleCaseName(cleaned).split(/\s+/)[0] || 'Professora'
  return firstName === 'Professora' ? firstName : `Prof. ${firstName}`
}

function formatCompactNumber(value: number) {
  if (value >= 1000) return `${Math.floor(value / 100) / 10}k`
  return String(value)
}

function formatFullNumber(value: number) {
  return String(Math.round(value))
}

function buildWeeklySummary(
  annotations: ReturnType<typeof useAppStore.getState>['annotations'],
  classes: ReturnType<typeof useAppStore.getState>['classes'],
) {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 7)

  const weekly = annotations.filter((annotation) => {
    const parsed = parseAnnotationDate(annotation.date)
    if (!parsed) return false
    return parsed >= from && parsed <= now
  })

  const categoryCounts = new Map<string, number>()
  const studentCounts = new Map<string, number>()
  for (const annotation of weekly) {
    categoryCounts.set(annotation.category, (categoryCounts.get(annotation.category) ?? 0) + 1)
    if (annotation.studentId) {
      studentCounts.set(annotation.studentId, (studentCounts.get(annotation.studentId) ?? 0) + 1)
    }
  }

  const topCategoryKey = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topCategory = topCategoryKey ? formatCategory(topCategoryKey) : 'Sem destaque'
  const topStudentId = [...studentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topStudent = topStudentId ? findStudentName(topStudentId, classes) : null

  const studentsWithWeeklyNotes = new Set(weekly.map((annotation) => annotation.studentId).filter(Boolean))
  const totalStudents = classes.reduce((acc, classItem) => acc + classItem.students.length, 0)
  const studentsWithoutRecentNote = Math.max(0, totalStudents - studentsWithWeeklyNotes.size)

  return {
    title: weekly.length ? 'Panorama da sua semana pedagógica' : 'Sem registros suficientes nesta semana',
    totalNotes: weekly.length,
    topCategory,
    topStudent,
    studentsWithoutRecentNote,
  }
}

function buildStudentsWithoutRecentNotes(
  annotations: ReturnType<typeof useAppStore.getState>['annotations'],
  classes: ReturnType<typeof useAppStore.getState>['classes'],
) {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 7)

  const recentByStudent = new Set(
    annotations
      .filter((annotation) => {
        const parsed = parseAnnotationDate(annotation.date)
        if (!parsed || !annotation.studentId) return false
        return parsed >= from && parsed <= now
      })
      .map((annotation) => annotation.studentId as string),
  )

  return classes
    .flatMap((classItem) =>
      classItem.students.map((student) => ({
        classId: classItem.id,
        className: classItem.name,
        studentId: student.id,
        studentName: student.name,
      })),
    )
    .filter((item) => !recentByStudent.has(item.studentId))
}

function parseAnnotationDate(value: string) {
  if (!value) return null
  const now = new Date()
  if (value.toLowerCase().startsWith('hoje')) return now
  if (value.toLowerCase().startsWith('agora')) return now

  const match = value.match(/(\d{2})\/(\d{2})/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2]) - 1
  if (!Number.isFinite(day) || !Number.isFinite(month)) return null

  const parsed = new Date(now.getFullYear(), month, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatCategory(category: string) {
  const labels: Record<string, string> = {
    evolucao: 'Evolução',
    plano: 'Planejamento',
    portfolio: 'Portfólio',
    projeto: 'Projeto',
    formacao: 'Formação',
    carta: 'Carta',
    atipico: 'Atípico',
  }
  return labels[category] ?? 'Anotações gerais'
}

function findStudentName(studentId: string, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  for (const classItem of classes) {
    const found = classItem.students.find((student) => student.id === studentId)
    if (found) return found.name
  }
  return null
}

