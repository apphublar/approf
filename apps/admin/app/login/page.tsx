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
    <main className="login-shell-v2">
      <form className="login-card-v2" onSubmit={handleSubmit}>
        <div className="login-brand-v2">
          <span className="brand-mark">A</span>
          <div>
            <strong>Approf Admin</strong>
            <small>Painel operacional</small>
          </div>
        </div>

        <p className="login-copy-v2">
          Entre com uma conta autorizada para operar professoras, assinaturas e conteúdo.
        </p>

        <div className="form-field-v2">
          <label htmlFor="admin-email">E-mail</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="form-field-v2">
          <label htmlFor="admin-password">Senha</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="login-error-v2">{error}</p> : null}

        <button className="btn-primary-v2" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Entrando...' : 'Entrar no painel'}
        </button>

        <div className="login-note-v2">
          <ShieldCheck size={16} />
          <span>Somente perfis admin ou super_admin podem acessar.</span>
        </div>
      </form>
    </main>
  )
}
