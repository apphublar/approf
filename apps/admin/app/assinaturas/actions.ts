'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '../lib/supabase-server'

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'blocked' | 'canceled'

const planOptions = [
  { value: 'free', label: 'Gratuito' },
  { value: 'trial_15_days', label: 'Teste 15 dias' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
  { value: 'verification_required', label: 'Em analise' },
]

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: 'trial', label: 'Teste' },
  { value: 'active', label: 'Ativa' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'canceled', label: 'Cancelada' },
]

export async function liberarAcessoGratuito(formData: FormData) {
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  if (!teacherId) return

  const supabase = createSupabaseServiceClient()

  // 1. Activate free subscription
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: teacherId,
        status: 'active',
        plan: 'free',
        provider: 'manual',
        external_reference: null,
        trial_expires_at: null,
        current_period_end: null,
        notes: 'Acesso gratuito liberado pelo admin.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (subError) throw new Error(`Subscriptions error: ${subError.message}`)

  // 2. Approve or create verification record
  const { data: existing } = await supabase
    .from('teacher_profile_verifications')
    .select('id')
    .eq('owner_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error: verErr } = await supabase
      .from('teacher_profile_verifications')
      .update({ status: 'approved', notes: 'Aprovado automaticamente junto com liberação de acesso gratuito.', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (verErr) throw new Error(`Verification update error: ${verErr.message}`)
  } else {
    const { error: verErr } = await supabase
      .from('teacher_profile_verifications')
      .insert({
        owner_id: teacherId,
        status: 'approved',
        notes: 'Aprovado automaticamente junto com liberação de acesso gratuito.',
        school_ids: [],
        documents: [],
      })
    if (verErr) throw new Error(`Verification insert error: ${verErr.message}`)
  }

  // 3. Log the action
  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_access_granted_free',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status: 'active', plan: 'free', verification: 'approved' },
  })

  redirect('/assinaturas')
}

export async function updateTeacherSubscription(formData: FormData) {
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as SubscriptionStatus
  const plan = String(formData.get('plan') ?? '').trim()
  const paymentLink = String(formData.get('paymentLink') ?? '').trim()
  const currentPeriodEnd = String(formData.get('currentPeriodEnd') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!teacherId || !statusOptions.some((o) => o.value === status)) return
  if (!planOptions.some((o) => o.value === plan)) return

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: teacherId,
        status,
        plan,
        provider: 'manual',
        external_reference: plan === 'free' ? null : paymentLink || null,
        trial_expires_at:
          plan === 'trial_15_days' && currentPeriodEnd
            ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString()
            : null,
        current_period_end:
          plan !== 'free' && currentPeriodEnd
            ? new Date(`${currentPeriodEnd}T23:59:59`).toISOString()
            : null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(`Subscriptions error: ${error.message}`)

  await supabase.from('admin_action_logs').insert({
    actor_id: null,
    action: 'teacher_subscription_updated',
    target_table: 'subscriptions',
    target_id: null,
    metadata: { teacherId, status, plan, paymentLink: paymentLink || null, currentPeriodEnd: currentPeriodEnd || null },
  })

  redirect('/assinaturas')
}
