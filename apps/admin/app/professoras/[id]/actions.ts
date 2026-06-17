'use server'

import { updateTeacherVerificationStatus } from '@/app/lib/account'
import { requireAdminSession } from '@/app/lib/admin-auth'
import { safeReturnPath } from '@/app/lib/admin-utils'
import { redirectWithToast } from '@/app/lib/redirect-with-toast'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export async function approveTeacherVerificationAction(formData: FormData) {
  const admin = await requireAdminSession()
  const verificationId = String(formData.get('verificationId') ?? '').trim()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const returnTo = safeReturnPath(formData.get('returnTo'), `/professoras/${teacherId}`)
  const notes = String(formData.get('notes') ?? '').trim()
  if (!verificationId) return

  await updateTeacherVerificationStatus({ verificationId, status: 'approved', reviewNotes: notes || undefined })

  const supabase = createSupabaseServiceClient()
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'verification_approved',
    target_table: 'teacher_profile_verifications',
    target_id: verificationId,
    metadata: { teacherId, notes: notes || null },
  })

  redirectWithToast(returnTo, 'Verificação aprovada.')
}

export async function rejectTeacherVerificationAction(formData: FormData) {
  const admin = await requireAdminSession()
  const verificationId = String(formData.get('verificationId') ?? '').trim()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const returnTo = safeReturnPath(formData.get('returnTo'), `/professoras/${teacherId}`)
  const notes = String(formData.get('notes') ?? '').trim()
  if (!verificationId) return

  await updateTeacherVerificationStatus({ verificationId, status: 'rejected', reviewNotes: notes || undefined })

  const supabase = createSupabaseServiceClient()
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'verification_rejected',
    target_table: 'teacher_profile_verifications',
    target_id: verificationId,
    metadata: { teacherId, notes: notes || null },
  })

  redirectWithToast(returnTo, 'Verificação rejeitada.')
}