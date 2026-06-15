'use client'

import { useEffect, useState } from 'react'

type DocumentWorkspace = {
  share: { coordinator_name: string; coordinator_email: string }
  teacher: { full_name: string | null; email: string | null } | null
  report: { id: string; report_type: string; body: string | null; created_at: string }
  student: { full_name: string | null } | null
  classData: { name: string; shift: string | null; age_group: string | null } | null
}

type InviteInfo = {
  coordinatorName: string
  coordinatorEmail: string
  accessStatus: string
  teacher: { name: string; email: string | null } | null
  reportType: string
}

export default function CoordinatorDocumentClient({ token }: { token: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const storageKey = `approf:coordinator-doc:${token}`

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) setAccessToken(saved)
  }, [storageKey])

  useEffect(() => {
    void loadInviteInfo()
  }, [token])

  useEffect(() => {
    if (!accessToken) return
    void loadWorkspace(accessToken)
  }, [accessToken])

  async function loadInviteInfo() {
    try {
      const response = await fetch(`/api/coordinator/public/document?token=${encodeURIComponent(token)}`)
      const payload = await response.json()
      if (!response.ok) return
      setInviteInfo(payload.share as InviteInfo)
      if (payload.share?.coordinatorEmail) setEmail(payload.share.coordinatorEmail)
    } catch {
      // Convite ainda pode ser validado manualmente.
    }
  }

  async function verify() {
    if (!email.trim() || !password.trim()) {
      setError('Informe o e-mail e a senha de acesso.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/coordinator/public/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim(), password: password.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Não foi possível validar o acesso.')
        return
      }
      window.localStorage.setItem(storageKey, payload.accessToken)
      setAccessToken(payload.accessToken)
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspace(nextAccessToken = accessToken) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/coordinator/public/document?token=${encodeURIComponent(token)}`, {
        headers: { 'x-coordinator-access': nextAccessToken },
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Acesso não validado. Verifique a senha.')
        window.localStorage.removeItem(storageKey)
        setAccessToken('')
        return
      }
      setWorkspace(payload as DocumentWorkspace)
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-white rounded-[18px] border border-[#E7E1D8] p-6 shadow-sm">
          <h1 className="font-serif text-[24px] text-[#123D2C] mb-2">Acesso ao documento</h1>
          <p className="text-[13px] text-[#666] leading-[1.6] mb-4">
            {inviteInfo?.teacher?.name
              ? `${inviteInfo.teacher.name} compartilhou ${formatReportType(inviteInfo.reportType)} com você.`
              : 'Use o e-mail do convite e a senha definida pela professora.'}
          </p>
          <label className="block text-[12px] text-[#666] mb-1">E-mail</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-[10px] border border-[#E7E1D8] px-3 py-3 text-[13px] mb-3"
            placeholder="E-mail da coordenadora"
          />
          <label className="block text-[12px] text-[#666] mb-1">Senha de acesso</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-[10px] border border-[#E7E1D8] px-3 py-3 text-[13px] mb-4 tracking-[0.2em]"
            placeholder="Senha de 6 caracteres"
          />
          {error && <p className="text-[12px] text-[#C1440E] mb-3">{error}</p>}
          <button
            type="button"
            onClick={() => void verify()}
            disabled={loading}
            className="w-full rounded-[10px] bg-[#3E7A3F] text-white py-3 text-[13px] font-bold disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F4EF] p-4">
      <div className="max-w-[860px] mx-auto bg-white rounded-[18px] border border-[#E7E1D8] p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.08em] text-[#666] mb-1">Documento compartilhado</p>
        <h1 className="font-serif text-[26px] text-[#123D2C] mb-2">{formatReportType(workspace.report.report_type)}</h1>
        <p className="text-[13px] text-[#666] mb-4">
          Professora: {workspace.teacher?.full_name || '—'}
          {workspace.classData?.name ? ` · Turma: ${workspace.classData.name}` : ''}
          {workspace.student?.full_name ? ` · Criança: ${workspace.student.full_name}` : ''}
        </p>
        <div
          className="rounded-[12px] border border-[#E7E1D8] bg-[#FCFAF7] p-4 text-[14px] leading-[1.7] text-[#333]"
          dangerouslySetInnerHTML={{ __html: workspace.report.body || '<p>Documento sem conteúdo.</p>' }}
        />
      </div>
    </div>
  )
}

function formatReportType(type: string) {
  switch (type) {
    case 'development_report': return 'Relatório de desenvolvimento'
    case 'class_diary': return 'Diário de bordo'
    case 'weekly_planning': return 'Planejamento semanal'
    case 'daily_lesson_plan': return 'Plano de aula diário'
    case 'pedagogical_project': return 'Projeto pedagógico'
    case 'portfolio_text':
    case 'portfolio_image': return 'Portfólio pedagógico'
    case 'generated_image': return 'Imagem pedagógica'
    case 'specialist_referral':
    case 'specialist_report': return 'Relatório para especialista'
    case 'parents_meeting_record': return 'Reunião de pais'
    case 'general_report': return 'Relatório pedagógico'
    default: return 'Documento pedagógico'
  }
}
