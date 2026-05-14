import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, Loader2 } from 'lucide-react'
import { requestPasswordReset, signInWithEmail, signOut, signUpTeacher, updatePassword } from '@/services/supabase/auth'
import { loadTeacherWorkspace } from '@/services/supabase/classes'
import { getSupabaseClient } from '@/services/supabase/client'
import { useAppStore } from '@/store'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(() => hasPasswordRecoveryUrl())
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const hydrateWorkspace = useAppStore((state) => state.hydrateWorkspace)

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
      setSession(nextSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    setLoadingWorkspace(true)
    loadTeacherWorkspace()
      .then((workspace) => hydrateWorkspace(workspace))
      .catch((error) => {
        console.error('Nao foi possivel carregar dados do Supabase.', error)
      })
      .finally(() => setLoadingWorkspace(false))
  }, [hydrateWorkspace, session])

  if (loadingSession || loadingWorkspace) {
    return (
      <div className="absolute inset-0 chalk-bg flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  if (!session || passwordRecovery) {
    return (
      <AuthScreen
        key={passwordRecovery ? 'reset' : 'signin'}
        initialMode={passwordRecovery ? 'reset' : 'signin'}
        onPasswordResetComplete={() => setPasswordRecovery(false)}
      />
    )
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
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel autenticar agora.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 chalk-bg flex flex-col overflow-hidden">
      <div className="px-5 pt-14 pb-4">
        <p className="font-chalk text-white/60 text-xl mb-1">Approf</p>
        <h1 className="font-chalk text-white text-4xl font-bold leading-tight">
          {getAuthTitle(mode)}
        </h1>
        <p className="text-white/60 text-sm mt-3 leading-relaxed">
          Acesso seguro para professoras da educacao infantil.
        </p>
      </div>

      <div className="px-5 pb-8 overflow-y-auto">
        <div className="bg-white rounded-app p-5 shadow-xl">
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setMode('signin')}
                className={`py-2 rounded-app-sm text-sm font-bold border ${
                  mode === 'signin' ? 'bg-gbg border-gp text-gm' : 'bg-white border-border text-muted'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`py-2 rounded-app-sm text-sm font-bold border ${
                  mode === 'signup' ? 'bg-gbg border-gp text-gm' : 'bg-white border-border text-muted'
                }`}
              >
                Cadastrar
              </button>
            </div>
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
                placeholder="voce@email.com"
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
                placeholder="Minimo 6 caracteres"
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
              Enviaremos um link seguro para voce criar uma nova senha.
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

          <div className="mt-4 flex items-center justify-center gap-3 text-xs font-bold text-gm">
            {mode === 'signin' && (
              <button onClick={() => setMode('forgot')} className="underline">
                Esqueci minha senha
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button onClick={() => setMode('signin')} className="underline">
                Voltar para entrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function hasPasswordRecoveryUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
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
