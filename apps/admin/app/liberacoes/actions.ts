'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '../lib/supabase-server'

type ReleaseMode = 'off' | 'selected' | 'all'

export async function setReleaseMode(formData: FormData) {
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const mode = String(formData.get('mode') ?? '').trim() as ReleaseMode

  if (!featureKey || !['off', 'selected', 'all'].includes(mode)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_flags')
    .update({ release_mode: mode, updated_at: new Date().toISOString() })
    .eq('key', featureKey)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'feature_mode_updated',
    target_table: 'feature_flags',
    target_id: null,
    metadata: { featureKey, mode },
  })

  redirect('/liberacoes')
}

export async function grantAccess(formData: FormData) {
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()

  if (!featureKey || !userId) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_user_access')
    .upsert({ feature_key: featureKey, user_id: userId, granted_by: null }, { onConflict: 'feature_key,user_id' })
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'feature_access_granted',
    target_table: 'feature_user_access',
    target_id: null,
    metadata: { featureKey, userId },
  })

  redirect('/liberacoes')
}

export async function revokeAccess(formData: FormData) {
  const featureKey = String(formData.get('featureKey') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()

  if (!featureKey || !userId) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('feature_user_access')
    .delete()
    .eq('feature_key', featureKey)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'feature_access_revoked',
    target_table: 'feature_user_access',
    target_id: null,
    metadata: { featureKey, userId },
  })

  redirect('/liberacoes')
}
