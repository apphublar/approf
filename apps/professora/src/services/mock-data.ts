import { MOCK_ANNOTATIONS, MOCK_CLASSES } from '@/data/mock'
import type { AppDataSnapshot } from './app-data'

export function getMockAppData(): AppDataSnapshot {
  return {
    userName: 'Ana Lima',
    schoolName: 'E.M. Joao XXIII',
    annotations: MOCK_ANNOTATIONS,
    classes: MOCK_CLASSES,
    boardNotes: [
      {
        id: 'demo1',
        title: 'Reuniao de pais',
        body: 'Sexta-feira as 19h na sala 3. Confirmar presenca.',
        chalk: true,
        expiresAt: '2026-05-09',
      },
    ],
  }
}
