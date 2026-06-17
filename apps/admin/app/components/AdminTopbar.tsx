'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { teacherInitials } from '../lib/admin-utils'

type SearchResult = {
  id: string
  name: string
  email: string
  status: string
  statusLabel: string
}

export function AdminTopbar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/teachers/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({ results: [] })) as { results?: SearchResult[] }
        setResults(payload.results ?? [])
        setOpen(true)
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setOpen(false)
        }
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  return (
    <header className="admin-topbar">
      <div className="admin-search-wrap" ref={rootRef}>
        <Search size={17} className="admin-search-icon" />
        <input
          className="admin-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Buscar professora por nome ou e-mail…"
          aria-label="Buscar professora"
        />
        {open && (
          <div className="admin-search-dropdown">
            {results.length === 0 ? (
              <div className="admin-search-empty">Nenhuma professora encontrada.</div>
            ) : (
              results.map((result) => (
                <Link
                  key={result.id}
                  className="admin-search-item"
                  href={`/professoras/${result.id}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="teacher-avatar">{teacherInitials(result.name)}</span>
                  <span className="admin-search-item-copy">
                    <strong>{result.name}</strong>
                    <small>{result.email}</small>
                  </span>
                  <span className={`status-chip status-chip-${result.status}`}>{result.statusLabel}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
      <div className="admin-topbar-spacer" />
      <span className="admin-env-pill">
        <span className="admin-env-dot" />
        {process.env.NEXT_PUBLIC_ADMIN_ENV === 'staging' ? 'Staging' : 'Producao'}
      </span>
    </header>
  )
}
