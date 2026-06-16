import { getSupabaseClient } from './client'

export type SignupPlan = 'monthly' | 'semiannual' | 'annual'

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAuthError(error)
  return data
}

export async function signUpTeacher(input: {
  fullName: string
  email: string
  password: string
  plan?: SignupPlan
  referralCode?: string | null
}) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const referralCode = input.referralCode?.trim().toUpperCase() || null

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        full_name: input.fullName,
        selected_plan: input.plan ?? getSelectedSignupPlanFromUrl(),
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
    },
  })

  if (error) throw toAuthError(error)
  return data
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw toAuthError(error)
}

export async function updatePassword(password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  await ensurePasswordRecoverySession()

  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw toAuthError(error)
  return data
}

export async function ensurePasswordRecoverySession() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não está configurado.')

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = searchParams.get('code')
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw toAuthError(error)
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw toAuthError(error)
  }

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    throw new Error('Link de recuperação expirado. Solicite um novo link.')
  }
}

export async function signOut() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  await supabase.auth.signOut()
}

export function getAuthErrorMessage(error: unknown) {
  if (!error) return 'Não foi possível autenticar agora.'

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Não foi possível autenticar agora.'
  const message = rawMessage.trim()
  const normalized = message.toLowerCase()

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('email address is already')
  ) {
    return 'Este e-mail já está cadastrado. Entre com sua senha ou recupere o acesso.'
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('email not confirmed')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.'
  }

  if (normalized.includes('email rate limit') || normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  }

  if (normalized.includes('password should be at least') || normalized.includes('weak password') || normalized.includes('signup requires a valid password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }

  if (normalized.includes('signup is disabled')) {
    return 'Novos cadastros estão temporariamente indisponíveis.'
  }

  if (normalized.includes('invalid email')) {
    return 'Informe um e-mail válido.'
  }

  if (normalized.includes('otp') || normalized.includes('token') || normalized.includes('expired')) {
    return 'O link expirou ou não é mais válido. Solicite um novo link.'
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Não foi possível conectar agora. Verifique sua internet e tente novamente.'
  }

  return message || 'Não foi possível autenticar agora.'
}

function toAuthError(error: unknown) {
  return new Error(getAuthErrorMessage(error))
}

export function getSelectedSignupPlanFromUrl(): SignupPlan {
  if (typeof window === 'undefined') return 'monthly'
  const plan = new URLSearchParams(window.location.search).get('plan')?.toLowerCase()
  if (plan === 'annual' || plan === 'anual' || plan === 'yearly') return 'annual'
  if (plan === 'semiannual' || plan === 'semestral' || plan === 'semi-annual') return 'semiannual'
  return 'monthly'
}

export function shouldStartStripeCheckoutFromUrl() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('checkout') === '1'
}
