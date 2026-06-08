import type { ClassData, Annotation } from '@/types'

export interface AchievementBadge {
  id: string
  label: string
  desc: string
  unlocked: boolean
}

export function computeAchievements(input: {
  annotations: Annotation[]
  classes: ClassData[]
  generatedReportsCount: number
  memberSince?: string | null
}) {
  const annotationCount = input.annotations.length
  const classCount = input.classes.length
  const studentCount = input.classes.reduce((total, cls) => total + cls.students.length, 0)
  const completeProfiles = input.classes
    .flatMap((cls) => cls.students)
    .filter((student) =>
      Boolean(student.birthDate)
      && Boolean(student.photoUrl || student.timeline?.length)
      && (student.timeline?.length ?? 0) + input.annotations.filter((ann) => ann.studentId === student.id).length > 0,
    ).length

  const activeDays = input.memberSince
    ? Math.max(0, Math.floor((Date.now() - new Date(input.memberSince).getTime()) / 86400000))
    : 0

  const badges: AchievementBadge[] = [
    {
      id: 'primeira',
      label: 'Primeira Anotação',
      desc: 'Você fez sua primeira anotação.',
      unlocked: annotationCount >= 1,
    },
    {
      id: '10ann',
      label: '10 Anotações',
      desc: 'Anotou 10 vezes com consistência.',
      unlocked: annotationCount >= 10,
    },
    {
      id: 'turma',
      label: 'Primeira Turma',
      desc: 'Cadastrou sua primeira turma.',
      unlocked: classCount >= 1,
    },
    {
      id: '50ann',
      label: '50 Anotações',
      desc: 'Você chegou a 50 registros.',
      unlocked: annotationCount >= 50,
    },
    {
      id: '1aluno',
      label: 'Perfil Completo',
      desc: 'Completou o perfil de um aluno.',
      unlocked: completeProfiles >= 1,
    },
    {
      id: 'ia',
      label: 'Primeiro relatório',
      desc: 'Gerou seu primeiro relatório.',
      unlocked: input.generatedReportsCount >= 1,
    },
    {
      id: '100ann',
      label: '100 Anotações',
      desc: '100 anotações registradas.',
      unlocked: annotationCount >= 100,
    },
    {
      id: '30dias',
      label: '30 dias ativo',
      desc: 'Usou o Approf por 30 dias.',
      unlocked: activeDays >= 30,
    },
    {
      id: '5alunos',
      label: 'Turma em formação',
      desc: 'Cadastrou 5 crianças em suas turmas.',
      unlocked: studentCount >= 5,
    },
  ]

  const unlockedCount = badges.filter((badge) => badge.unlocked).length
  return { badges, unlockedCount }
}

const MEMBER_SINCE_KEY = 'approf-member-since'

export function rememberMemberSince(userId: string) {
  if (typeof window === 'undefined') return null
  const key = `${MEMBER_SINCE_KEY}:${userId}`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const now = new Date().toISOString()
  window.localStorage.setItem(key, now)
  return now
}

export function getMemberSince(userId: string) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(`${MEMBER_SINCE_KEY}:${userId}`)
}
