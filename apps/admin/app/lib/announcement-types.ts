export type AnnouncementType = 'novidade' | 'info' | 'alerta' | 'manutencao'
export type AnnouncementAudience = 'todas' | 'pagando' | 'trial' | 'atraso' | 'verificadas'

export const ANNOUNCEMENT_TYPES: Record<
  AnnouncementType,
  { label: string; accent: string }
> = {
  novidade: { label: 'Novidade', accent: '#1c6b46' },
  info: { label: 'Informacao', accent: '#2f5f9e' },
  alerta: { label: 'Atencao', accent: '#8a6516' },
  manutencao: { label: 'Manutencao', accent: '#b4382f' },
}

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  todas: 'Todas as professoras',
  pagando: 'Pagantes',
  trial: 'Em trial',
  atraso: 'Em atraso',
  verificadas: 'Verificadas',
}
