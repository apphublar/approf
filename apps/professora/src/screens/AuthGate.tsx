import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react'
import { getAuthErrorMessage, getEmailVerificationStateFromUser, getSelectedSignupPlanFromUrl, requestPasswordReset, resendSignupConfirmation, shouldStartStripeCheckoutFromUrl, signInWithEmail, signOut, signUpTeacher, updatePassword, completeAuthRedirectIfPresent, isEmailConfirmed, type SignupPlan } from '@/services/supabase/auth'
import { redirectToStripeCheckout } from '@/services/stripe-checkout'
import EmailVerificationBanner from '@/components/ui/EmailVerificationNotice'
import { resolveEmailVerificationState, type EmailVerificationState } from '@/utils/email-verification'
import { captureReferralCodeFromUrl, clearStoredReferralCode, getStoredReferralCode } from '@/utils/referral'
import { loadTeacherWorkspace } from '@/services/supabase/classes'
import { getSupabaseClient } from '@/services/supabase/client'
import {
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  onSubscriptionStateChange,
} from '@/services/supabase/account'
import { loadDocumentStyleSettings, saveDocumentStyleSettings } from '@/utils/document-style'
import TeacherAccountSubscreen from '@/subscreens/TeacherAccount'
import { useAppStore, useOnboardingStore } from '@/store'
import { rememberMemberSince } from '@/utils/achievements'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'
const HYDRATED_USER_KEY = 'approf:hydrated-user-id'

const SIGNUP_PLAN_OPTIONS: Array<{
  id: SignupPlan
  title: string
  shortDesc: string
  details: string[]
}> = [
  {
    id: 'monthly',
    title: 'Plano Mensal',
    shortDesc: 'R$ 39,90/mês · 8.000 GizTokens mensais · cobrança mensal no cartão',
    details: [
      'De R$ 49,90 por R$ 39,90/mês',
      '8.000 GizTokens todo mês para relatórios, planejamentos e chat com IA',
      'Cobrança mensal no cartão, sem fidelidade',
      'Cancele quando quiser, sem multa',
    ],
  },
  {
    id: 'semiannual',
    title: 'Plano Semestral',
    shortDesc: 'R$ 34,90/mês equiv. · 9.000 GizTokens · cobrança única de R$ 209,40 a cada 6 meses',
    details: [
      'Economia de 2 meses em relação ao plano mensal',
      '9.000 GizTokens todo mês para IA pedagógica',
      'Cobrança única de R$ 209,40 a cada 6 meses no cartão',
      'Sem fidelidade — cancele quando quiser',
    ],
  },
  {
    id: 'annual',
    title: 'Plano Anual',
    shortDesc: 'R$ 29,90/mês equiv. · 10.000 GizTokens · cobrança única de R$ 358,80 por ano',
    details: [
      'Melhor custo-benefício: economia de 4 meses',
      '10.000 GizTokens todo mês — o maior pacote disponível',
      'Cobrança única de R$ 358,80 por ano no cartão',
      'Sem fidelidade — cancele quando quiser',
    ],
  },
]

function readPersistedHydratedUserId() {
  try {
    return sessionStorage.getItem(HYDRATED_USER_KEY)
  } catch {
    return null
  }
}

function persistHydratedUserId(userId: string | null) {
  try {
    if (userId) sessionStorage.setItem(HYDRATED_USER_KEY, userId)
    else sessionStorage.removeItem(HYDRATED_USER_KEY)
  } catch {
    // sessionStorage indisponível
  }
}
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(() => hasPasswordRecoveryUrl())
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false)
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState>(() =>
    resolveEmailVerificationState(null),
  )
  const [emailNoticeMessage, setEmailNoticeMessage] = useState('')
  const [emailNoticeSending, setEmailNoticeSending] = useState(false)
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(readPersistedHydratedUserId)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const hydrateWorkspace = useAppStore((state) => state.hydrateWorkspace)
  const setOnboardingCompleted = useOnboardingStore((state) => state.setCompleted)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setLoadingSession(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(hasPasswordRecoveryUrl() ? null : data.session)
      setEmailVerification(getEmailVerificationStateFromUser(data.session?.user))
      setLoadingSession(false)
    })

    void completeAuthRedirectIfPresent()
      .then((handled) => {
        if (!handled) return
        return supabase.auth.getSession().then(({ data }) => {
          setSession(data.session)
          setEmailVerification(getEmailVerificationStateFromUser(data.session?.user))
        })
      })
      .catch(() => {
        // Link inválido/expirado: mantém fluxo normal de login.
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        setSession(null)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setHydratedUserId(null)
        persistHydratedUserId(null)
        setSubscriptionBlocked(false)
        return
      }
      setSession(nextSession)
      setEmailVerification(getEmailVerificationStateFromUser(nextSession?.user))
      const nextUserId = nextSession?.user?.id ?? null
      if (event === 'SIGNED_IN' && nextUserId) {
        setHydratedUserId((current) => {
          if (current === nextUserId) return current
          persistHydratedUserId(null)
          return null
        })
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let hiddenAt: number | null = null
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
        if (Date.now() - hiddenAt > 30 * 60 * 1000) {
          setHydratedUserId(null)
          persistHydratedUserId(null)
        }
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    if (hydratedUserId === userId) return

    const persistedUserId = readPersistedHydratedUserId()
    if (persistedUserId === userId) {
      setHydratedUserId(userId)
      return
    }

    setLoadingWorkspace(true)
    setWorkspaceError(null)
    loadTeacherWorkspace()
      .then((workspace) => {
        hydrateWorkspace(workspace)
        setOnboardingCompleted(Boolean(workspace.onboardingCompleted))
        rememberMemberSince(userId)
        setHydratedUserId(userId)
        persistHydratedUserId(userId)
      })
      .catch((error) => {
        console.error('Não foi possível carregar dados do Supabase.', error)
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar seus dados. Verifique a conexão e tente novamente.',
        )
      })
      .finally(() => {
        setLoadingWorkspace(false)
      })
  }, [hydrateWorkspace, hydratedUserId, session?.user?.id, setOnboardingCompleted])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    let active = true
    async function refreshAccess() {
      setCheckingAccess(true)
      try {
        const snapshot = await getTeacherAccountSnapshot()
        if (!active) return
        setSubscriptionBlocked(isTeacherAccessBlocked(snapshot.subscription?.status ?? null))
        if (snapshot.schoolLogoUrl && !loadDocumentStyleSettings().schoolLogoDataUrl) {
          saveDocumentStyleSettings({ schoolLogoDataUrl: snapshot.schoolLogoUrl })
        }
      } catch {
        if (!active) return
        setSubscriptionBlocked(false)
      } finally {
        if (active) setCheckingAccess(false)
      }
    }

    void refreshAccess()
    const unsubscribe = onSubscriptionStateChange(() => {
      void refreshAccess()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user || emailVerification.status !== 'grace') return
    const timer = window.setInterval(() => {
      setEmailVerification(getEmailVerificationStateFromUser(session.user))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [emailVerification.status, session?.user])

  async function handleResendConfirmationEmail() {
    const targetEmail = session?.user?.email?.trim()
    if (!targetEmail) return
    setEmailNoticeSending(true)
    setEmailNoticeMessage('')
    try {
      await resendSignupConfirmation(targetEmail)
      setEmailNoticeMessage('Novo e-mail de confirmação enviado. Verifique também a caixa de spam.')
    } catch (error) {
      setEmailNoticeMessage(getAuthErrorMessage(error))
    } finally {
      setEmailNoticeSending(false)
    }
  }

  const emailAccessBlocked = emailVerification.status === 'blocked'
  const emailGraceActive = emailVerification.status === 'grace'
  const sessionUserId = session?.user?.id ?? null
  const effectiveHydratedUserId = hydratedUserId ?? readPersistedHydratedUserId()
  const isWorkspaceReady = !sessionUserId || effectiveHydratedUserId === sessionUserId
  const shouldBlockForWorkspace = loadingWorkspace && !isWorkspaceReady
  const shouldBlockForAccess = checkingAccess && !isWorkspaceReady
  if (loadingSession || shouldBlockForWorkspace || shouldBlockForAccess) {
    return (
      <div className="absolute inset-0 chalk-bg flex items-center justify-center px-6">
        <div className="auth-loading-wrap">
          <img
            src="/branding/logo-approf.png"
            alt="Approf"
            className="auth-loading-logo"
          />
          <div className="auth-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    )
  }

  if (!session || passwordRecovery) {
    return (
      <AuthScreen
        key={passwordRecovery ? 'reset' : 'signin'}
        initialMode={passwordRecovery ? 'reset' : getInitialAuthMode()}
        onPasswordResetComplete={() => setPasswordRecovery(false)}
      />
    )
  }

  if (subscriptionBlocked || emailAccessBlocked) {
    return (
      <TeacherAccountSubscreen
        data={{
          forcedMode: true,
          forcedReason: emailAccessBlocked ? 'email' : 'subscription',
        }}
      />
    )
  }

  if (workspaceError) {
    return (
      <div className="absolute inset-0 chalk-bg flex items-center justify-center px-6">
        <div className="max-w-sm w-full bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-[15px] font-semibold text-ink mb-2">Não foi possível carregar seus dados</p>
          <p className="text-[13px] text-soft mb-5">{workspaceError}</p>
          <button
            type="button"
            className="w-full bg-forest text-white rounded-xl py-3 text-[14px] font-semibold"
            onClick={() => setHydratedUserId(null)}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!isWorkspaceReady) {
    return (
      <div className="absolute inset-0 chalk-bg flex items-center justify-center px-6">
        <div className="auth-loading-wrap">
          <img
            src="/branding/logo-approf.png"
            alt="Approf"
            className="auth-loading-logo"
          />
          <div className="auth-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {emailGraceActive && session?.user?.email && (
        <EmailVerificationBanner
          email={session.user.email}
          state={emailVerification}
          sending={emailNoticeSending}
          message={emailNoticeMessage}
          onResend={() => void handleResendConfirmationEmail()}
        />
      )}
      <div className={emailGraceActive ? 'absolute inset-0 pt-[92px]' : 'absolute inset-0'}>
        {children}
      </div>
    </>
  )
}

function AuthScreen({
  initialMode = 'signin',
  onPasswordResetComplete,
}: {
  initialMode?: AuthMode
  onPasswordResetComplete?: () => void
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false)
  const [installMessage, setInstallMessage] = useState('')
  const [installDismissed, setInstallDismissed] = useState(() => getLocalStorageFlag('approf:pwa-install-dismissed'))
  const [installInstalled, setInstallInstalled] = useState(() => isRunningStandalone() || getLocalStorageFlag('approf:pwa-installed'))
  const [isStandalone, setIsStandalone] = useState(() => isRunningStandalone())
  const [referralCode, setReferralCode] = useState<string | null>(() => getStoredReferralCode())
  const [selectedSignupPlan, setSelectedSignupPlan] = useState<SignupPlan>(() => getSelectedSignupPlanFromUrl())
  const [expandedPlanId, setExpandedPlanId] = useState<SignupPlan | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isIos = isIosDevice()
  const showSignupPlanPicker = mode === 'signup' && !shouldStartStripeCheckoutFromUrl()
  const passwordStrength = mode === 'signup' ? getPasswordStrength(password) : null
  const shouldShowInstallPopup =
    !isStandalone &&
    !installInstalled &&
    !installDismissed &&
    (Boolean(installPrompt) || isIos) &&
    (mode === 'signin' || mode === 'signup')

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstallPrompt(null)
      setInstallInstalled(true)
      setInstallDismissed(true)
      setLocalStorageFlag('approf:pwa-installed', true)
      setLocalStorageFlag('approf:pwa-install-dismissed', true)
      setInstallMessage('App instalado com sucesso.')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    const captured = captureReferralCodeFromUrl()
    if (captured) setReferralCode(captured)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const updateStandaloneState = () => {
      const nextStandalone = isRunningStandalone()
      setIsStandalone(nextStandalone)
      if (nextStandalone) {
        setInstallInstalled(true)
        setInstallDismissed(true)
        setLocalStorageFlag('approf:pwa-installed', true)
        setLocalStorageFlag('approf:pwa-install-dismissed', true)
      }
    }

    updateStandaloneState()
    media.addEventListener?.('change', updateStandaloneState)
    return () => media.removeEventListener?.('change', updateStandaloneState)
  }, [])

  async function submit() {
    setMessage('')
    if (mode === 'forgot') {
      if (!email.trim()) {
        setMessage('Informe seu e-mail.')
        return
      }
    } else if (mode === 'reset') {
      if (!password.trim() || password.length < 6) {
        setMessage('Informe uma nova senha com pelo menos 6 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setMessage('As senhas precisam ser iguais.')
        return
      }
    } else if (!email.trim() || !password.trim()) {
      setMessage('Informe e-mail e senha.')
      return
    } else if (mode === 'signup' && !fullName.trim()) {
      setMessage('Informe o nome da professora.')
      return
    } else if (mode === 'signup') {
      if (password.length < 6) {
        setMessage('A senha precisa ter pelo menos 6 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setMessage('As senhas precisam ser iguais.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else if (mode === 'signup') {
        const signupPlan = showSignupPlanPicker ? selectedSignupPlan : getSelectedSignupPlanFromUrl()
        const data = await signUpTeacher({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          plan: signupPlan,
          referralCode,
        })
        clearStoredReferralCode()
        setReferralCode(null)
        if (data.session && shouldStartStripeCheckoutFromUrl()) {
          if (isEmailConfirmed(data.user)) {
            await redirectToStripeCheckout(getSelectedSignupPlanFromUrl())
            return
          }
        }
        if (!data.session) {
          setMessage(
            referralCode
              ? 'Cadastro criado com indicação. Confira seu e-mail para confirmar a conta e ganhar 7 dias extras de teste.'
              : 'Cadastro criado. Confira seu e-mail para confirmar a conta antes de continuar.',
          )
          setMode('signin')
        } else if (shouldStartStripeCheckoutFromUrl() && !isEmailConfirmed(data.user)) {
          setMessage('Cadastro criado. Confirme seu e-mail para continuar com o pagamento.')
        }
      } else if (mode === 'forgot') {
        await requestPasswordReset(email.trim())
        setMessage('Enviamos um link para redefinir sua senha.')
      } else {
        await updatePassword(password)
        await signOut()
        onPasswordResetComplete?.()
        window.history.replaceState(null, '', window.location.pathname)
        setMessage('Senha atualizada. Agora entre com sua nova senha.')
        setPassword('')
        setConfirmPassword('')
        setMode('signin')
      }
    } catch (error) {
      setMessage(getAuthErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function installApp() {
    setInstallMessage('')
    try {
      if (isStandalone) {
        setInstallInstalled(true)
        setLocalStorageFlag('approf:pwa-installed', true)
        setInstallMessage('O app já está instalado neste dispositivo.')
        return
      }
      if (installPrompt) {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        setInstallPrompt(null)
        if (choice.outcome === 'accepted') {
          setInstallInstalled(true)
          setInstallDismissed(true)
          setLocalStorageFlag('approf:pwa-installed', true)
          setLocalStorageFlag('approf:pwa-install-dismissed', true)
          setInstallMessage('Instalação iniciada.')
        }
        return
      }
      if (isIos) {
        setShowIosInstallHelp((current) => !current)
        return
      }
      setInstallMessage('Use o menu do navegador e selecione "Instalar app".')
    } catch {
      setInstallMessage('Não foi possível iniciar a instalação agora.')
    }
  }

  function dismissInstallPopup() {
    setInstallDismissed(true)
    setShowIosInstallHelp(false)
    setLocalStorageFlag('approf:pwa-install-dismissed', true)
  }

  return (
    <div className="auth-screen absolute inset-0 chalk-bg overflow-y-auto">
      <div className="auth-screen__content">
        <div className="auth-screen__header">
        <p className="font-chalk text-white/60 text-xl mb-1">Approf</p>
        <h1 className="font-chalk text-white text-4xl font-bold leading-tight">
          {getAuthTitle(mode)}
        </h1>
        <p className="text-white/60 text-sm mt-3 leading-relaxed">
          Acesso seguro para professoras da educação infantil.
        </p>
        </div>

        <div className="auth-screen__form">
          <div className="bg-white rounded-app p-5 shadow-xl">
          {(mode === 'signin' || mode === 'signup') && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setMode('signin')}
                className={`py-2 rounded-app-sm text-sm font-bold border ${mode === 'signin' ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
              >
                Entrar
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`py-2 rounded-app-sm text-sm font-bold border ${mode === 'signup' ? 'bg-gbg border-gp text-gd' : 'bg-white border-border text-muted'}`}
              >
                Criar conta
              </button>
            </div>
          )}

          {installMessage && (
            <p className="mb-4 text-xs text-gd bg-gbg border border-gp rounded-app-sm p-3">{installMessage}</p>
          )}

          {mode === 'signup' && referralCode && (
            <p className="mb-4 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[12px] leading-[1.5] text-gd">
              Você entrou por indicação da prof
              {' '}
              <strong>{referralCode}</strong>
              . Ao confirmar o cadastro, ganha 7 dias extras de teste.
            </p>
          )}

          {showSignupPlanPicker && (
            <Field label="Escolha seu plano">
              <div className="flex flex-col gap-2">
                {SIGNUP_PLAN_OPTIONS.map((option) => (
                  <SignupPlanChoice
                    key={option.id}
                    selected={selectedSignupPlan === option.id}
                    expanded={expandedPlanId === option.id}
                    title={option.title}
                    shortDesc={option.shortDesc}
                    details={option.details}
                    onClick={() => {
                      setSelectedSignupPlan(option.id)
                      setExpandedPlanId((current) => (current === option.id ? null : option.id))
                    }}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted leading-relaxed">
                {referralCode
                  ? 'Teste grátis por 14 dias (7 + 7 extras pela indicação). O pagamento só é feito ao final do teste.'
                  : 'Teste grátis por 7 dias. O pagamento só é feito ao final do teste.'}
              </p>
            </Field>
          )}

          {mode === 'signup' && (
            <Field label="Nome da professora">
              <input
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
                placeholder="Ex: Aline Fontinhas"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
          )}

          {mode !== 'reset' && (
            <Field label="E-mail">
              <input
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
                type="email"
                placeholder="você@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          )}

          {mode !== 'forgot' && (
            <Field label={mode === 'reset' ? 'Nova senha' : 'Senha'}>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Mínimo 6 caracteres"
                visible={showPassword}
                onToggleVisible={() => setShowPassword((current) => !current)}
              />
              {mode === 'signup' && passwordStrength && (
                <PasswordStrengthBar strength={passwordStrength} />
              )}
            </Field>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <Field label={mode === 'reset' ? 'Confirmar nova senha' : 'Confirmar senha'}>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repita a senha"
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword((current) => !current)}
              />
            </Field>
          )}

          {mode === 'forgot' && (
            <p className="text-xs text-muted leading-relaxed mb-4">
              Enviaremos um link seguro para você criar uma nova senha.
            </p>
          )}

          {message && (
            <p className="bg-gbg border border-gp rounded-app-sm p-3 text-xs text-gd leading-relaxed mb-4">
              {message}
            </p>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-4 rounded-app bg-gm text-white font-bold text-base flex items-center justify-center gap-2 shadow-fab disabled:opacity-60"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            {getSubmitLabel(mode)}
          </button>

          <div className="mt-4 flex flex-col items-center justify-center gap-2 text-xs font-bold text-gm">
            {mode === 'signin' && (
              <button onClick={() => setMode('forgot')} className="underline">
                Esqueci minha senha
              </button>
            )}
            {mode === 'signin' && (
              <button
                onClick={() => setMode('signup')}
                className="w-full py-3 rounded-app-sm border border-gp bg-white text-gm text-sm font-bold"
              >
                Criar conta
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button onClick={() => setMode('signin')} className="underline">
                Voltar para entrar
              </button>
            )}
            {mode === 'signup' && (
              <button onClick={() => setMode('signin')} className="underline">
                Voltar para entrar
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {shouldShowInstallPopup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-5">
          <div className="w-full max-w-sm rounded-app bg-white p-5 shadow-xl">
            <p className="text-[15px] font-bold text-ink">Instalar o Approf</p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Acesse o app pela tela inicial do celular, com abertura mais rápida e experiência de aplicativo.
            </p>

            {showIosInstallHelp && isIos && (
              <div className="mt-4 rounded-app-sm border border-border bg-cream p-3 text-xs text-muted leading-relaxed">
                <p className="font-bold text-ink mb-1">Instalar no iPhone</p>
                <p>1. Toque no botão compartilhar do Safari.</p>
                <p>2. Toque em "Adicionar à Tela de Início".</p>
                <p>3. Confirme em "Adicionar".</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={dismissInstallPopup}
                className="py-3 rounded-app-sm border border-border bg-white text-muted text-sm font-bold"
              >
                Agora não
              </button>
              <button
                onClick={() => void installApp()}
                className="py-3 rounded-app-sm border border-gp bg-gbg text-gd text-sm font-bold"
              >
                Instalar app
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

function isRunningStandalone() {
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function getLocalStorageFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setLocalStorageFlag(key: string, value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(key, '1')
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage can be unavailable in privaté browsing.
  }
}

function hasPasswordRecoveryUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
}

function getInitialAuthMode(): AuthMode {
  if (typeof window === 'undefined') return 'signin'
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
}

function getAuthTitle(mode: AuthMode) {
  if (mode === 'signup') return 'Criar conta'
  if (mode === 'forgot') return 'Recuperar senha'
  if (mode === 'reset') return 'Nova senha'
  return 'Entrar no app'
}

function getSubmitLabel(mode: AuthMode) {
  if (mode === 'signup') return 'Criar conta'
  if (mode === 'forgot') return 'Enviar link'
  if (mode === 'reset') return 'Salvar senha'
  return 'Entrar'
}

function SignupPlanChoice({
  selected,
  expanded,
  title,
  shortDesc,
  details,
  onClick,
}: {
  selected: boolean
  expanded: boolean
  title: string
  shortDesc: string
  details: string[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-app-sm border text-left px-3 py-3"
      style={{
        borderColor: selected ? '#4F8341' : '#D4EBC8',
        background: selected ? '#F0FAF4' : '#fff',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="block text-[13px] font-bold" style={{ color: selected ? '#4F8341' : '#1A1A1A' }}>{title}</span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      <span
        className={`block text-[11px] text-muted mt-[2px] leading-snug ${expanded ? '' : 'line-clamp-2'}`}
      >
        {shortDesc}
      </span>
      {expanded && (
        <ul className="mt-2 pt-2 border-t border-border/60 space-y-1">
          {details.map((item) => (
            <li key={item} className="text-[11px] text-muted leading-snug flex gap-1.5">
              <span className="text-gm mt-[1px]">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  )
}

type PasswordStrength = 'weak' | 'medium' | 'strong'

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return 'weak'
  if (score <= 4) return 'medium'
  return 'strong'
}

function PasswordStrengthBar({ strength }: { strength: PasswordStrength }) {
  const config = {
    weak: { label: 'Fraca', color: '#E57373', width: '33%' },
    medium: { label: 'Média', color: '#FFB74D', width: '66%' },
    strong: { label: 'Forte', color: '#4F8341', width: '100%' },
  }[strength]

  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: config.width, background: config.color }}
        />
      </div>
      <p className="mt-1 text-[10px] font-semibold" style={{ color: config.color }}>
        Senha {config.label.toLowerCase()}
      </p>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisible,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  visible: boolean
  onToggleVisible: () => void
}) {
  return (
    <div className="relative">
      <input
        className="w-full px-4 py-3 pr-11 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold text-soft mb-[5px]">{label}</span>
      {children}
    </label>
  )
}
