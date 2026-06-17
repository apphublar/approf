import { createSupabaseServiceClient } from './supabase-server'

export type AdminNavBadges = {
  verificacoes: number
  materiais: number
}

type VerificationRow = {
  owner_id: string
  status: string
  created_at: string
}

/** Conta apenas a solicitação mais recente por professora com status pendente. */
export function countActionableVerifications(rows: VerificationRow[]) {
  const latestByOwner = new Map<string, VerificationRow>()
  for (const row of rows) {
    const ownerId = String(row.owner_id)
    const existing = latestByOwner.get(ownerId)
    if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latestByOwner.set(ownerId, row)
    }
  }
  return [...latestByOwner.values()].filter((row) => row.status === 'pending').length
}

export async function loadAdminNavBadges(): Promise<AdminNavBadges> {
  const supabase = createSupabaseServiceClient()
  const [verificationsResult, reportsResult] = await Promise.all([
    supabase
      .from('teacher_profile_verifications')
      .select('owner_id, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('material_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  if (verificationsResult.error) throw verificationsResult.error

  return {
    verificacoes: countActionableVerifications((verificationsResult.data ?? []) as VerificationRow[]),
    materiais: reportsResult.count ?? 0,
  }
}
