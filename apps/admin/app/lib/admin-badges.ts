import { createSupabaseServiceClient } from './supabase-server'

export type AdminNavBadges = {
  verificacoes: number
  materiais: number
}

export async function loadAdminNavBadges(): Promise<AdminNavBadges> {
  const supabase = createSupabaseServiceClient()
  const [verificationsResult, reportsResult] = await Promise.all([
    supabase
      .from('teacher_profile_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('material_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  return {
    verificacoes: verificationsResult.count ?? 0,
    materiais: reportsResult.count ?? 0,
  }
}
