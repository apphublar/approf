import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, Loader2 } from 'lucide-react'
import { getAuthErrorMessage, getSelectedSignupPlanFromUrl, requestPasswordReset, signInWithEmail, signOut, signUpTeacher, updatePassword } from '@/services/supabase/auth'
import { loadTeacherWorkspace } from '@/services/supabase/classes'
import { getSupabaseClient } from '@/services/supabase/client'
import {
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  onSubscriptionStateChange,
} from '@/services/supabase/account'
import TeacherAccountSubscreen from '@/subscreens/TeacherAccount'
import { useAppStore, useOnboardingStore } from '@/store'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'
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
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
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
      setLoadingSession(false)
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
        setSubscriptionBlocked(false)
        return
      }
      setSession(nextSession)
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setHydratedUserId(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    if (hydratedUserId === userId) return

    setLoadingWorkspace(true)
    loadTeacherWorkspace()
      .then((workspace) => {
        hydrateWorkspace(workspace)
        setOnboardingCompleted(Boolean(workspace.onboardingCompleted))
      })
      .catch((error) => {
        console.error('Não foi possível carregar dados do Supabase.', error)
      })
      .finally(() => {
        setHydratedUserId(userId)
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

  if (loadingSession || loadingWorkspace || checkingAccess) {
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

  if (subscriptionBlocked) {
    return <TeacherAccountSubscreen data={{ forcedMode: true }} />
  }

  return children
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

  const isIos = isIosDevice()
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
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else if (mode === 'signup') {
        const data = await signUpTeacher({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          plan: getSelectedSignupPlanFromUrl(),
        })
        if (!data.session) {
          setMessage('Cadastro criado. Confira seu e-mail para confirmar a conta.')
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
              <input
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          )}

          {mode === 'reset' && (
            <Field label="Confirmar nova senha">
              <input
                className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold text-soft mb-[5px]">{label}</span>
      {children}
    </label>
  )
}
