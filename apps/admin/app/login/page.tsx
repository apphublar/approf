'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [nextPath, setNextPath] = useState('/')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next')
    if (next?.startsWith('/')) setNextPath(next)
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível entrar.')
      }

      router.replace(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>Approf Admin</strong>
            <small>Acesso restrito</small>
          </div>
        </div>

        <p className="login-copy">
          Entre com uma conta de administrador autorizada para operar o painel interno.
        </p>

        <label className="login-label" htmlFor="admin-email">E-mail</label>
        <input
          id="admin-email"
          className="login-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label className="login-label" htmlFor="admin-password">Senha</label>
        <input
          id="admin-password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="login-note">
          <ShieldCheck size={16} />
          <span>Somente perfis admin ou super_admin podem acessar este painel.</span>
        </div>
      </form>
    </main>
  )
}
