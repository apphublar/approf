import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Bot,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  MoveRight,
  ScrollText,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react'

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badgeKey?: 'verificacoes' | 'materiais'
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: '',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Pessoas',
    items: [
      { href: '/professoras', label: 'Professoras', icon: Users },
      { href: '/verificacoes', label: 'Verificações', icon: UserRoundCheck, badgeKey: 'verificacoes' },
      { href: '/assinaturas', label: 'Assinaturas', icon: CreditCard },
      { href: '/continuidade', label: 'Continuidade', icon: MoveRight },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { href: '/materiais', label: 'Materiais', icon: FileText, badgeKey: 'materiais' },
      { href: '/liberacoes', label: 'Liberações', icon: KeyRound },
    ],
  },
  {
    label: 'Comunicação',
    items: [{ href: '/avisos', label: 'Avisos no app', icon: Megaphone }],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/ia', label: 'Uso de IA', icon: Bot },
      { href: '/notificacoes', label: 'Notificações', icon: Bell },
      { href: '/auditoria', label: 'Auditoria', icon: ScrollText },
      { href: '/privacidade', label: 'Privacidade', icon: LockKeyhole },
    ],
  },
]

export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '/professoras') {
    return pathname === '/professoras' || pathname.startsWith('/professoras/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
