import type { BoardNote } from '@/types'
import { getSupabaseClient } from './client'

export async function loadBoardNotes(userId: string): Promise<BoardNote[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('board_notes')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return []
  return Array.isArray(data.board_notes) ? (data.board_notes as BoardNote[]) : []
}

export async function syncBoardNotes(userId: string, notes: BoardNote[]): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado para salvar o quadro.')

  const { error } = await supabase
    .from('profiles')
    .update({ board_notes: notes, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

export function mergeBoardNotes(local: BoardNote[], remote: BoardNote[]) {
  const merged = new Map<string, BoardNote>()
  remote.forEach((note) => merged.set(note.id, note))
  local.forEach((note) => merged.set(note.id, note))
  return Array.from(merged.values())
}
