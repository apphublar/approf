import type { Annotation, BoardNote, ClassData } from '@/types'
import { getMockAppData } from './mock-data'

export type AppDataMode = 'mock' | 'supabase'

export interface AppDataSnapshot {
  userName: string
  schoolName: string
  annotations: Annotation[]
  classes: ClassData[]
  boardNotes: BoardNote[]
}

export function getAppDataMode(): AppDataMode {
  return import.meta.env.VITE_APPROF_DATA_MODE === 'supabase' ? 'supabase' : 'mock'
}

export function getInitialAppData(): AppDataSnapshot {
  if (getAppDataMode() === 'supabase') {
    return getSupabasePlaceholderData()
  }

  return getMockAppData()
}

function getSupabasePlaceholderData(): AppDataSnapshot {
  console.warn(
    'Approf data mode is set to Supabase, but Supabase is not connected yet. Falling back to local mock data.',
  )

  return getMockAppData()
}
