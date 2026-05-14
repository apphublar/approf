import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Approf — O app da prof',
  description:
    'O app para professoras da Educação Infantil. Anote seus alunos, gere relatórios com IA e acesse material pedagógico pronto — tudo no celular, sem instalar nada.',
  keywords: [
    'app professora',
    'educação infantil',
    'relatório pedagógico',
    'plano de aula',
    'IA educação',
  ],
  authors: [{ name: 'Approf' }],
  openGraph: {
    title: 'Approf — O app da prof',
    description:
      'Anote, organize turmas e gere relatórios com IA. Feito para professoras da Educação Infantil.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Approf',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Approf — O app da prof',
    description: 'O app para professoras da Educação Infantil.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
