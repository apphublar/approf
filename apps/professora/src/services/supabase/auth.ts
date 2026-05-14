import { getSupabaseClient } from './client'

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpTeacher(input: { fullName: string; email: string; password: string }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        full_name: input.fullName,
      },
    },
  })

  if (error) throw error
  return data
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase nao esta configurado.')

  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  await supabase.auth.signOut()
}
