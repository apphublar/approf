import type { User } from '@supabase/supabase-js'

export const EMAIL_VERIFICATION_GRACE_MS = 24 * 60 * 60 * 1000

export type EmailVerificationStatus = 'confirmed' | 'grace' | 'blocked'

export type EmailVerificationState = {
  status: EmailVerificationStatus
  confirmed: boolean
  createdAt: string | null
  confirmedAt: string | null
  deadline: string | null
  msRemaining: number
}

function readUserCreatedAt(user: Pick<User, 'created_at'>) {
  return user.created_at ?? null
}

export function isEmailConfirmed(user: Pick<User, 'email_confirmed_at' | 'confirmed_at'> | null | undefined) {
  if (!user) return false
  return Boolean(user.email_confirmed_at || user.confirmed_at)
}

export function resolveEmailVerificationState(
  user: Pick<User, 'email_confirmed_at' | 'confirmed_at' | 'created_at'> | null | undefined,
  now = Date.now(),
): EmailVerificationState {
  if (!user) {
    return {
      status: 'confirmed',
      confirmed: true,
      createdAt: null,
      confirmedAt: null,
      deadline: null,
      msRemaining: 0,
    }
  }

  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null
  if (confirmedAt) {
    return {
      status: 'confirmed',
      confirmed: true,
      createdAt: readUserCreatedAt(user),
      confirmedAt,
      deadline: null,
      msRemaining: 0,
    }
  }

  const createdAt = readUserCreatedAt(user)
  const createdMs = createdAt ? new Date(createdAt).getTime() : now
  const deadlineMs = createdMs + EMAIL_VERIFICATION_GRACE_MS
  const msRemaining = Math.max(0, deadlineMs - now)
  const deadline = new Date(deadlineMs).toISOString()

  if (msRemaining <= 0) {
    return {
      status: 'blocked',
      confirmed: false,
      createdAt,
      confirmedAt: null,
      deadline,
      msRemaining: 0,
    }
  }

  return {
    status: 'grace',
    confirmed: false,
    createdAt,
    confirmedAt: null,
    deadline,
    msRemaining,
  }
}

export function formatEmailVerificationDeadline(deadlineIso: string | null) {
  if (!deadlineIso) return 'em breve'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(deadlineIso))
}

export function formatEmailVerificationCountdown(msRemaining: number) {
  const totalMinutes = Math.max(0, Math.ceil(msRemaining / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}
