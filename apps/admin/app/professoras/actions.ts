'use server'

import { redirect } from 'next/navigation'
import { requireAdminSession } from '../lib/admin-auth'
import { adjustTeacherGiztokens } from '../lib/giztokens-admin'
import { createSupabaseServiceClient } from '../lib/supabase-server'

export async function adjustTeacherGiztokensAction(formData: FormData) {
  const admin = await requireAdminSession()
  const teacherId = String(formData.get('teacherId') ?? '').trim()
  const modeRaw = String(formData.get('mode') ?? 'add').trim()
  const amount = Number(String(formData.get('amount') ?? '').replace(',', '.'))
  const reason = String(formData.get('reason') ?? '').trim()
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
    },
  })

  redirect('/professoras')
}
