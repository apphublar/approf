import {
  Bell,
  Bot,
  CreditCard,
  FileText,
  KeyRound,
  LockKeyhole,
  MoveRight,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react'

export const adminSections = [
  { href: '/', label: 'Dashboard', icon: ShieldCheck },
  { href: '/professoras', label: 'Professoras', icon: Users },
  { href: '/verificacoes', label: 'Verificacoes', icon: UserRoundCheck },
  { href: '/assinaturas', label: 'Assinaturas', icon: CreditCard },
  { href: '/materiais', label: 'Materiais', icon: FileText },
  { href: '/liberacoes', label: 'Liberacoes', icon: KeyRound },
  { href: '/continuidade', label: 'Continuidade', icon: MoveRight },
  { href: '/ia', label: 'Uso de IA', icon: Bot },
  { href: '/privacidade', label: 'Privacidade', icon: LockKeyhole },
  { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { href: '/notificacoes', label: 'Notificacoes', icon: Bell },
]
