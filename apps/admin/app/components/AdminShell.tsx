'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { adminNavGroups, isNavActive } from '../lib/admin-nav'
import type { AdminNavBadges } from '../lib/admin-badges'
import { AdminTopbar } from './AdminTopbar'
import { ToastHost } from './ToastHost'

export function AdminShell({
  badges: initialBadges,
  children,
}: {
  badges: AdminNavBadges
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [badges, setBadges] = useState(initialBadges)

  useEffect(() => {
    setBadges(initialBadges)
  }, [initialBadges])

  useEffect(() => {
    if (pathname === '/login') return
    void fetch('/api/admin/nav-badges')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AdminNavBadges | null) => {
        if (payload) setBadges(payload)
      })
      .catch(() => null)
  }, [pathname])

  if (pathname === '/login') {
    return <>{children}</>
  }

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="admin-shell-v2">
      <aside className="sidebar-v2" aria-label="Navegação admin">
        <Link href="/" className="brand-link-v2">
          <span className="brand-mark">A</span>
          <span>
            <strong>Approf Admin</strong>
            <small>Operação e privacidade</small>
          </span>
        </Link>

        <nav className="nav-groups">
          {adminNavGroups.map((group) => (
            <div key={group.label || 'root'} className="nav-group">
              {group.label ? <p className="nav-group-label">{group.label}</p> : null}
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isNavActive(pathname, item.href)
                  const badge = item.badgeKey ? badges[item.badgeKey] : 0
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link-v2${active ? ' nav-link-v2-active' : ''}`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {badge > 0 ? <span className="nav-badge">{badge}</span> : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer-v2">
          <div className="sidebar-note-v2">
            <ShieldCheck size={15} />
            <span>Dados sensíveis exigem RLS, auditoria e buckets privados.</span>
          </div>
          <button type="button" className="logout-button-v2" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </aside>

      <main className="admin-main-v2">
        <AdminTopbar />
        <div className="admin-content-v2">
          {children}
        </div>
        <Suspense fallback={null}>
          <ToastHost />
        </Suspense>
      </main>
    </div>
  )
}
