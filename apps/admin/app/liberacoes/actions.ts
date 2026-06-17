'use server'

import { requireAdminSession } from '../lib/admin-auth'
import { redirectWithToast } from '../lib/redirect-with-toast'
import { createSupabaseServiceClient } from '../lib/supabase-server'

type ReleaseMode = 'off' | 'selected' | 'all'

export async function setReleaseMode(formData: FormData) {
  const admin = await requireAdminSession()
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const mode = String(formData.get('mode') ?? '').trim() as ReleaseMode
  const featureName = String(formData.get('featureName') ?? featureKey).trim()

  if (!featureKey || !['off', 'selected', 'all'].includes(mode)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_flags')
    .update({ release_mode: mode, updated_at: new Date().toISOString() })
    .eq('key', featureKey)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'feature_mode_updated',
    target_table: 'feature_flags',
    target_id: null,
    metadata: { featureKey, mode },
  })

  const label = mode === 'all' ? 'todas as contas' : 'selecionadas'
  redirectWithToast('/liberacoes', `${featureName} → ${label}.`)
}

export async function grantAccess(formData: FormData) {
  const admin = await requireAdminSession()
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const teacherName = String(formData.get('teacherName') ?? 'Professora').trim()

  if (!featureKey || !userId) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_user_access')
    .upsert({ feature_key: featureKey, user_id: userId, granted_by: admin.userId }, { onConflict: 'feature_key,user_id' })
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'feature_access_granted',
    target_table: 'feature_user_access',
    target_id: null,
    metadata: { featureKey, userId, teacherName },
  })

  redirectWithToast('/liberacoes', `Acesso liberado para ${teacherName.split(' ')[0]}.`)
}

export async function revokeAccess(formData: FormData) {
  const admin = await requireAdminSession()
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const teacherName = String(formData.get('teacherName') ?? 'Professora').trim()

  if (!featureKey || !userId) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_user_access')
    .delete()
    .eq('feature_key', featureKey)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'feature_access_revoked',
    target_table: 'feature_user_access',
    target_id: null,
    metadata: { featureKey, userId, teacherName },
  })

  redirectWithToast('/liberacoes', `Acesso removido de ${teacherName.split(' ')[0]}.`)
}
