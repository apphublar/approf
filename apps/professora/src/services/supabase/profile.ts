import { getSupabaseClient } from './client'

export async function updateTeacherOnboardingProfile(input: {
  fullName?: string
  estimatedStudentCount?: number
}) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('Sessao nao encontrada.')

  const update = {
    ...(input.fullName?.trim() ? { full_name: input.fullName.trim() } : {}),
    ...(typeof input.estimatedStudentCount === 'number'
      ? { estimated_student_count: Math.max(0, Math.min(300, input.estimatedStudentCount)) }
      : {}),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)

  if (error) throw toError(error, 'Nao foi possivel salvar os dados iniciais.')
}

function toError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; error_description?: string }
    const message = record.message || record.details || record.hint || record.error_description
    if (message) return new Error(message)
  }
  return new Error(fallbackMessage)
}
