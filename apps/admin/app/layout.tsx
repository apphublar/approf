import type { Metadata } from 'next'
import { AdminShell } from './components/AdminShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Approf Admin',
  description: 'Painel interno de operacao e privacidade do Approf',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
