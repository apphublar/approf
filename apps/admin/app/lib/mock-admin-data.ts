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

export const dashboardMetrics = [
  { label: 'Professoras', value: '128', detail: '+18 nos ultimos 7 dias', icon: Users },
  { label: 'Trials ativos', value: '42', detail: '9 vencem em 48h', icon: UserRoundCheck },
  { label: 'Assinaturas manuais', value: '73', detail: '5 precisam revisao', icon: CreditCard },
  { label: 'Relatorios IA', value: '386', detail: 'R$ 41,80 em uso estimado', icon: Bot },
]

export const adminSections = [
  { href: '/', label: 'Dashboard', icon: ShieldCheck },
  { href: '/professoras', label: 'Professoras', icon: Users },
  { href: '/assinaturas', label: 'Assinaturas', icon: CreditCard },
  { href: '/materiais', label: 'Materiais', icon: FileText },
  { href: '/liberacoes', label: 'Liberacoes', icon: KeyRound },
  { href: '/continuidade', label: 'Continuidade', icon: MoveRight },
  { href: '/ia', label: 'Uso de IA', icon: Bot },
  { href: '/privacidade', label: 'Privacidade', icon: LockKeyhole },
  { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { href: '/notificacoes', label: 'Notificacoes', icon: Bell },
]

export const teachers = [
  {
    name: 'Ana Lima',
    email: 'ana@escola.com.br',
    status: 'trial',
    plan: '15 dias',
    school: 'E.M. Joao XXIII',
    classes: 3,
    students: 57,
    aiReports: 12,
  },
  {
    name: 'Marina Costa',
    email: 'marina@escola.com.br',
    status: 'active',
    plan: 'mensal manual',
    school: 'Escola Brincar',
    classes: 2,
    students: 34,
    aiReports: 28,
  },
  {
    name: 'Beatriz Rocha',
    email: 'bia@escola.com.br',
    status: 'overdue',
    plan: 'anual manual',
    school: 'CMEI Jardim',
    classes: 1,
    students: 19,
    aiReports: 4,
  },
]

export const subscriptions = [
  { teacher: 'Ana Lima', status: 'trial', plan: 'Trial 15 dias', provider: 'manual', endsAt: '2026-05-23' },
  { teacher: 'Marina Costa', status: 'active', plan: 'Mensal', provider: 'manual', endsAt: '2026-06-08' },
  { teacher: 'Beatriz Rocha', status: 'overdue', plan: 'Anual', provider: 'manual', endsAt: '2026-05-02' },
]

export const materialCategories = [
  { name: 'Modelos de Relatorio', count: 12, published: 10 },
  { name: 'Planos de Aula', count: 24, published: 21 },
  { name: 'Atividades Impressas', count: 18, published: 16 },
  { name: 'Portfolio do Aluno', count: 8, published: 6 },
  { name: 'Avaliacao e Registro', count: 15, published: 12 },
  { name: 'Datas Comemorativas', count: 9, published: 9 },
]

export const materials = [
  {
    title: 'Relatorio semestral - Educacao Infantil',
    category: 'Modelos de Relatorio',
    type: 'DOCX',
    status: 'published',
    downloads: 86,
    updatedAt: '2026-05-07',
  },
  {
    title: 'Plano de aula - Horta escolar',
    category: 'Planos de Aula',
    type: 'PDF',
    status: 'published',
    downloads: 142,
    updatedAt: '2026-05-05',
  },
  {
    title: 'Ficha de observacao individual',
    category: 'Avaliacao e Registro',
    type: 'PDF',
    status: 'draft',
    downloads: 0,
    updatedAt: '2026-05-08',
  },
  {
    title: 'Atividade impressa - vogais',
    category: 'Atividades Impressas',
    type: 'PDF',
    status: 'archived',
    downloads: 53,
    updatedAt: '2026-04-28',
  },
]

export const aiUsage = [
  { teacher: 'Marina Costa', reports: 28, tokens: '94k', cost: 'R$ 11,40', flag: 'normal' },
  { teacher: 'Ana Lima', reports: 12, tokens: '38k', cost: 'R$ 4,82', flag: 'normal' },
  { teacher: 'Beatriz Rocha', reports: 4, tokens: '19k', cost: 'R$ 2,10', flag: 'review' },
]

export const privacyTasks = [
  'Validar consentimento antes de anexar fotos de criancas.',
  'Manter buckets de fotos e PDFs sempre privados.',
  'Auditar liberacoes manuais de acesso no painel interno.',
  'Revisar uso anormal de IA antes de aumentar limites.',
  'Nao enviar dados completos de criancas por Telegram ou email.',
]

export const auditLogs = [
  { actor: 'Super Admin', action: 'Liberou assinatura manual', target: 'Marina Costa', date: '2026-05-08 09:12' },
  { actor: 'Super Admin', action: 'Publicou material', target: 'Plano de aula - Horta escolar', date: '2026-05-07 18:44' },
  { actor: 'Sistema', action: 'Enfileirou alerta de trial', target: 'Ana Lima', date: '2026-05-07 08:00' },
]

export const notifications = [
  { type: 'Trial expirando', channel: 'email', status: 'queued', target: 'Ana Lima' },
  { type: 'Relatorio pronto', channel: 'telegram', status: 'sent', target: 'Marina Costa' },
  { type: 'Pagamento manual pendente', channel: 'system', status: 'queued', target: 'Beatriz Rocha' },
]

export const featureFlags = [
  {
    key: 'community',
    name: 'Comunidade',
    mode: 'selected',
    globalEnabled: false,
    allowedTeachers: ['Ana Lima', 'Marina Costa'],
    description: 'Feed de postagens entre professoras. Pode ser liberado globalmente ou por conta.',
  },
]

export const continuityMetrics = [
  { label: 'Solicitacoes pendentes', value: '7', detail: '3 sem codigo da crianca' },
  { label: 'Transferencias abertas', value: '4', detail: '2 aguardam aceite' },
  { label: 'Vinculos aprovados', value: '38', detail: 'ultimos 30 dias' },
  { label: 'Casos sensiveis', value: '2', detail: 'exigem revisao manual' },
]

export const childLinkRequests = [
  {
    child: 'Manuela Martins',
    childCode: 'CRI-MAN-8R4Q',
    birthDate: '2021-10-18',
    requester: 'Patricia Gomes',
    requesterCode: 'PROF-PAT-2026',
    previousTeacher: 'Camila Torres',
    school: 'E.M. Joao XXIII',
    status: 'review',
    reason: 'Professora nova sem acesso ao codigo. Encontrou por nome e data de nascimento.',
    preview: ['Adaptacao registrada', 'Avancos em autonomia', 'Participacao em musicalizacao'],
    safeTimelinePreview: [
      { date: 'Mar/2026', category: 'Adaptacao', summary: 'Entrada na rotina com acolhimento gradual e boa resposta a combinados visuais.' },
      { date: 'Abr/2026', category: 'Autonomia', summary: 'Passou a guardar pertences com menos apoio em momentos de transicao.' },
      { date: 'Mai/2026', category: 'Musicalizacao', summary: 'Participou de roda cantada e acompanhou gestos coletivos.' },
    ],
  },
  {
    child: 'Lucas Mendes',
    childCode: 'CRI-LUC-4F8K',
    birthDate: '2022-03-12',
    requester: 'Marina Costa',
    requesterCode: 'PROF-MAR-2026',
    previousTeacher: 'Ana Lima',
    school: 'E.M. Joao XXIII',
    status: 'queued',
    reason: 'Codigo informado pela professora anterior. Aguardando aceite.',
    preview: ['Avanco na linguagem', 'Participacao na roda', 'Mais autonomia na transicao'],
    safeTimelinePreview: [
      { date: 'Abr/2026', category: 'Linguagem', summary: 'Nomeou objetos da historia com apoio reduzido durante roda de conversa.' },
      { date: 'Abr/2026', category: 'Socializacao', summary: 'Permaneceu na roda e respondeu quando chamado pelo nome.' },
      { date: 'Mai/2026', category: 'Autonomia', summary: 'Guardou materiais apos aviso antecipado de transicao.' },
    ],
  },
]

export const childTransfers = [
  {
    child: 'Valentina Nunes',
    childCode: 'CRI-VAL-9B6N',
    fromTeacher: 'Ana Lima',
    fromCode: 'PROF-ANA-2026',
    toTeacher: 'Renata Prado',
    toCode: 'PROF-REN-2026',
    status: 'queued',
    reason: 'Troca de professora no segundo semestre.',
    date: '2026-05-09 10:22',
  },
  {
    child: 'Helena Moura',
    childCode: 'CRI-HEL-6C8W',
    fromTeacher: 'Marina Costa',
    fromCode: 'PROF-MAR-2026',
    toTeacher: 'Marina Costa',
    toCode: 'PROF-MAR-2026',
    status: 'normal',
    reason: 'Movida para Pre-escola A na mesma conta.',
    date: '2026-05-08 16:40',
  },
]

export const continuityAudit = [
  { actor: 'Sistema', action: 'Detectou possivel duplicidade', target: 'Manuela Martins', date: '2026-05-09 09:48' },
  { actor: 'Ana Lima', action: 'Solicitou transferencia', target: 'Valentina Nunes para PROF-REN-2026', date: '2026-05-09 10:22' },
  { actor: 'Super Admin', action: 'Aprovou vinculo manual', target: 'Lucas Mendes', date: '2026-05-08 13:15' },
]
