import { useEffect, useMemo, useState } from 'react'
import { Award, BookOpenText, Bot, Flame, Lock, NotebookPen, School, Star, UserRoundSearch, Users } from 'lucide-react'
import { useAppStore } from '@/store'
import { listReports } from '@/services/reports'
import { computeAchievements, getMemberSince, rememberMemberSince } from '@/utils/achievements'

const BADGE_ICONS = {
  primeira: NotebookPen,
  '10ann': BookOpenText,
  turma: School,
  '50ann': Star,
  '1aluno': UserRoundSearch,
  ia: Bot,
  '100ann': Award,
  '30dias': Flame,
  '5alunos': Users,
} as const

const BADGE_COLORS = {
  unlocked: { color: '#D8F3DC', fg: '#4F8341' },
  locked: { color: '#eee', fg: '#aaa' },
  special: { color: '#FFF3CD', fg: '#856404' },
}

export default function AchievementsScreen() {
  const { annotations, classes, userId } = useAppStore()
  const [generatedReportsCount, setGeneratedReportsCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    rememberMemberSince(userId)
  }, [userId])

  useEffect(() => {
    const classIds = classes.map((item) => item.id).filter(Boolean)
    if (!classIds.length) {
      setGeneratedReportsCount(0)
      return
    }

    let active = true
    Promise.all(classIds.map((classId) => listReports({ classId, compact: true, limit: 200 })))
      .then((results) => {
        if (!active) return
        const total = results
          .flat()
          .filter((report) => report.status !== 'failed').length
        setGeneratedReportsCount(total)
      })
      .catch(() => {
        if (!active) return
        setGeneratedReportsCount(0)
      })

    return () => {
      active = false
    }
  }, [classes])

  const { badges, unlockedCount } = useMemo(
    () =>
      computeAchievements({
        annotations,
        classes,
        generatedReportsCount,
        memberSince: userId ? getMemberSince(userId) : null,
      }),
    [annotations, classes, generatedReportsCount, userId],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-[14px] border-b border-border flex-shrink-0">
        <span className="font-serif text-[22px] text-gd">Conquistas</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="bg-gd rounded-app p-4 mt-[14px] mb-[18px] text-center chalk-bg">
          <span className="font-chalk text-white text-xl block">{unlockedCount} conquistadas</span>
          <span className="font-chalk text-white/55 text-sm">{badges.length - unlockedCount} ainda por desbloquear</span>
        </div>

        <div className="grid grid-cols-2 gap-[11px]">
          {badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.id as keyof typeof BADGE_ICONS] ?? Award
            const palette = badge.unlocked
              ? badge.id === 'turma' ? BADGE_COLORS.special : BADGE_COLORS.unlocked
              : BADGE_COLORS.locked

            return (
              <div
                key={badge.id}
                className={`bg-white rounded-app p-4 border border-border flex flex-col items-center text-center gap-2 ${!badge.unlocked ? 'opacity-45' : ''}`}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: palette.color }}
                >
                  {badge.unlocked ? <Icon size={26} color={palette.fg} /> : <Lock size={24} color="#888" />}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-ink leading-tight">{badge.label}</p>
                  <p className="text-[10px] text-muted mt-[2px] leading-snug">{badge.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
