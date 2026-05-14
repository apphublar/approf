import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Check, Loader2 } from 'lucide-react'
import { signInWithEmail, signUpTeacher } from '@/services/supabase/auth'
import { loadTeacherWorkspace } from '@/services/supabase/classes'
import { getSupabaseClient } from '@/services/supabase/client'
import { useAppStore } from '@/store'

type AuthMode = 'signin' | 'signup'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
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
      setSession(data.session)
      setLoadingSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

  if (!session) return <AuthScreen />

  return children
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    setMessage('')
    if (!email.trim() || !password.trim()) {
      setMessage('Informe e-mail e senha.')
      return
    }
    if (mode === 'signup' && !fullName.trim()) {
      setMessage('Informe o nome da professora.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else {
        const data = await signUpTeacher({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        })
        if (!data.session) {
          setMessage('Cadastro criado. Confira seu e-mail para confirmar a conta.')
        }
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
          {mode === 'signin' ? 'Entrar no app' : 'Criar conta'}
        </h1>
        <p className="text-white/60 text-sm mt-3 leading-relaxed">
          Acesso seguro para professoras da educacao infantil.
        </p>
      </div>

      <div className="px-5 pb-8 overflow-y-auto">
        <div className="bg-white rounded-app p-5 shadow-xl">
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

          <Field label="E-mail">
            <input
              className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Senha">
            <input
              className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white text-sm text-ink outline-none focus:border-gl"
              type="password"
              placeholder="Minimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

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
            {mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
      </div>
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
