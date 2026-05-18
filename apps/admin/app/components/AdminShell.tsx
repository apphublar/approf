import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { adminSections } from '../lib/mock-admin-data'

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell">
      <aside className="sidebar" aria-label="Navegação admin">
        <div>
          <Link href="/" className="brand-link">
            <span className="brand-mark">A</span>
            <span>
              <strong>Approf Admin</strong>
              <small>Operação e privacidade</small>
            </span>
          </Link>

          <nav className="nav-list">
            {adminSections.map((item) => {
              const Icon = item.icon
              return (
                <Link className="nav-link" href={item.href} key={item.href}>
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="sidebar-note">
          <ShieldCheck size={16} />
          <span>Dados sensíveis exigem RLS, auditoria e buckets privados.</span>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  )
}
