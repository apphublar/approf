import type { GeneratedDocument } from '@/types'
import { getSupabaseClient } from './supabase/client'

export async function createManualReport(input: {
  reportType: string
  body: string
  studentId?: string | null
  classId?: string | null
  promptVersion?: string | null
}) {
  const apiBaseUrl = import.meta.env.VITE_APPROF_ADMIN_API_URL?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new Error('Backend de documentos não configurado. Informe VITE_APPROF_ADMIN_API_URL.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase não configurado para salvar documentos.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  const response = await fetch(`${apiBaseUrl}/api/reports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null) as { error?: string; report?: GeneratedDocument } | null
  if (!response.ok) {
    const message = payload?.error || 'Não foi possível criar o documento manual.'
    throw new Error(message)
  }

  if (!payload?.report) {
    throw new Error('Resposta inválida ao criar documento manual.')
  }

  return payload.report
}
