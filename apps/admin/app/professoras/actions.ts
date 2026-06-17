'use server'

import { requireAdminSession } from '../lib/admin-auth'
import { adjustTeacherGiztokens } from '../lib/giztokens-admin'
import { safeReturnPath } from '../lib/admin-utils'
import { redirectWithToast } from '../lib/redirect-with-toast'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export async function adjustTeacherGiztokensAction(formData: FormData) {
  const admin = await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const modeRaw = String(formData.get('mode') ?? 'add').trim()
  const amount = Number(String(formData.get('amount') ?? '').replace(',', '.'))
  const reason = String(formData.get('reason') ?? '').trim()
  const returnTo = safeReturnPath(formData.get('returnTo'), '/professoras')
  const mode = modeRaw === 'set_minimum' ? 'set_minimum' : 'add'

  const result = await adjustTeacherGiztokens({
    ownerId: teacherId,
    mode,
    amount,
    reason,
  })

  const supabase = createSupabaseServiceClient()
  await supabase.from('admin_action_logs').insert({
    actor_id: admin.userId,
    action: 'teacher_giztokens_adjusted',
    target_table: 'ai_usage_wallets',
    target_id: teacherId,
    metadata: {
      mode: result.mode,
      amount: result.amount,
      previousIncluded: result.previousIncluded,
      nextIncluded: result.nextIncluded,
      giztokensRemaining: result.giztokensRemaining,
      reason: reason || null,
      teacherEmail: result.teacherEmail,
      teacherName: result.teacherName,
      teacherId,
    },
  })

  const firstName = result.teacherName.split(' ')[0] || 'professora'
  redirectWithToast(returnTo, `Saldo atualizado: ${result.giztokensRemaining.toLocaleString('pt-BR')} Giz para ${firstName}`)
}
