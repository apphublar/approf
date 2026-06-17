import { AdminShell } from './components/AdminShell'
import { loadAdminNavBadges } from './lib/admin-badges'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Approf Admin',
  description: 'Painel interno de operação e privacidade do Approf',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
    shortcut: '/icon.png',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let badges = { verificacoes: 0, materiais: 0 }
  try {
    badges = await loadAdminNavBadges()
  } catch {
    // Build/prerender without Supabase credentials falls back to zero badges.
  }

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AdminShell badges={badges}>{children}</AdminShell>
      </body>
    </html>
  )
}
