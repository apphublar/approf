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
      data: {
        full_name: input.fullName,
      },
    },
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  await supabase.auth.signOut()
}
