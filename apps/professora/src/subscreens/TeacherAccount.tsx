import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, LogOut, ShieldCheck, Wallet } from 'lucide-react'
import { useNavStore } from '@/store'
import {
  cancelTeacherSubscription,
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  logoutTeacher,
  submitTeacherVerificationRequest,
  updateTeacherProfile,
  uploadTeacherVerificationDocuments,
  type TeacherAccountSnapshot,
} from '@/services/supabase/account'

export default function TeacherAccountSubscreen({ data }: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const forcedMode = typeof data === 'object' && data && 'forcedMode' in data
    ? Boolean((data as { forcedMode?: boolean }).forcedMode)
    : false
  const [snapshot, setSnapshot] = useState<TeacherAccountSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  async function refreshAccount() {
    const account = await getTeacherAccountSnapshot()
    setSnapshot(account)
    setFullName(account.fullName)
    setPhone(account.phone ?? '')
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    refreshAccount()
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar sua conta.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const blocked = useMemo(() => isTeacherAccessBlocked(snapshot?.subscription?.status ?? null), [snapshot])

  async function saveProfile() {
    if (!snapshot) return
    setSaving(true)
    setError('')
    try {
      await updateTeacherProfile({ fullName: fullName.trim(), phone: phone.trim() || null })
      await refreshAccount()
      setMessage('Cadastro atualizado com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar seu cadastro.')
    } finally {
      setSaving(false)
    }
  }

  async function requestCancellation() {
    setSaving(true)
    setError('')
    try {
      await cancelTeacherSubscription()
      await refreshAccount()
      setMessage('Assinatura cancelada. O app ficará restrito ao menu de conta.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a assinatura.')
    } finally {
      setSaving(false)
    }
  }

  function queueVerificationFiles(files: FileList | null) {
    if (!files?.length) return
    setPendingFiles((current) => [...current, ...Array.from(files)].slice(-10))
  }

  async function submitVerification() {
    if (!snapshot) return
    if (!pendingFiles.length) {
      setError('Anexe ao menos um documento para enviar a verificação.')
      return
    }

    setSubmittingVerification(true)
    setError('')
    try {
      const uploaded = await uploadTeacherVerificationDocuments(pendingFiles)
      await submitTeacherVerificationRequest({
        schoolIds: snapshot.schools.map((school) => school.id),
        notes: verificationNotes.trim() || undefined,
        documents: uploaded,
      })
      setPendingFiles([])
      setVerificationNotes('')
      await refreshAccount()
      setMessage('Solicitação de verificação enviada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a verificação.')
    } finally {
      setSubmittingVerification(false)
    }
  }

  async function logout() {
    setSaving(true)
    await logoutTeacher()
    setSaving(false)
    window.location.reload()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        {!forcedMode && (
          <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="font-serif text-[18px] text-gd flex-1">Minha conta</span>
      </div>

      <div className="scroll-area px-[18px] py-4">
        {loading ? (
          <div className="bg-white rounded-app p-4 border border-border text-[12px] text-muted">Carregando conta...</div>
        ) : !snapshot ? (
          <div className="bg-white rounded-app p-4 border border-red-200 text-[12px] text-red-700">{error || 'Conta indisponível.'}</div>
        ) : (
          <>
            {blocked && (
              <div className="bg-[#FFF3CD] border border-[#F2D58B] rounded-app p-4 mb-4">
                <p className="text-[13px] font-bold text-[#856404]">Acesso restrito por assinatura</p>
                <p className="text-[12px] text-[#856404] mt-1 leading-[1.5]">
                  Enquanto a assinatura estiver cancelada ou em atraso, apenas este menu ficará disponível.
                </p>
              </div>
            )}

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Cadastro</p>
              <label className="text-[11px] text-muted">Nome completo</label>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <label className="text-[11px] text-muted">Telefone</label>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <p className="text-[11px] text-muted">E-mail: {snapshot.email}</p>
              <button onClick={saveProfile} disabled={saving} className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </button>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} className="text-gm" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Assinatura</p>
              </div>
              <p className="text-[13px] font-bold text-ink">Status: {formatSubscriptionStatus(snapshot.subscription?.status)}</p>
              <p className="text-[12px] text-muted mt-1">Plano: {snapshot.subscription?.plan ?? 'Não identificado'}</p>
              <p className="text-[12px] text-muted mt-1">Provedor: {formatProvider(snapshot.subscription?.provider)}</p>
              <p className="text-[12px] text-muted mt-1">Próximo vencimento: {formatDate(snapshot.subscription?.currentPeriodEnd)}</p>
              <button onClick={requestCancellation} disabled={saving || blocked} className="w-full mt-3 py-2 rounded-app-sm border border-[#C1440E] text-[#C1440E] text-[12px] font-bold disabled:opacity-50">
                {blocked ? 'Assinatura já restrita' : 'Cancelar assinatura'}
              </button>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={15} className="text-gm" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Verificação de perfil</p>
              </div>
              <p className="text-[12px] text-muted leading-[1.5]">
                Anexe documentos que comprovem vínculo com sua escola. Se atuar em mais de uma escola, envie comprovantes para todas.
              </p>
              <textarea
                value={verificationNotes}
                onChange={(event) => setVerificationNotes(event.target.value)}
                placeholder="Observações para a equipe (opcional)."
                className="w-full mt-3 min-h-[88px] rounded-app-sm border border-border px-3 py-2 text-[12px]"
              />
              <label className="w-full mt-3 inline-flex justify-center py-2 rounded-app-sm border border-gp text-gd text-[12px] font-bold cursor-pointer">
                Anexar documentos
                <input type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => queueVerificationFiles(event.target.files)} />
              </label>
              {pendingFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pendingFiles.map((file, index) => (
                    <p key={`${file.name}-${index}`} className="text-[11px] text-muted">
                      {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </p>
                  ))}
                </div>
              )}
              <button onClick={submitVerification} disabled={submittingVerification} className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50">
                {submittingVerification ? 'Enviando verificação...' : 'Enviar para verificação'}
              </button>
              {snapshot.verifications.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-muted mb-2">Solicitações enviadas</p>
                  {snapshot.verifications.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-app-sm border border-border p-3 mb-2">
                      <p className="text-[12px] font-bold text-ink">
                        Status: {item.status === 'pending' ? 'pendente' : item.status === 'approved' ? 'aprovada' : 'rejeitada'}
                      </p>
                      <p className="text-[11px] text-muted mt-1">
                        {item.documents.length} documento(s) · {formatDate(item.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Escolas vinculadas</p>
              {snapshot.schools.length === 0 ? (
                <p className="text-[12px] text-muted">Nenhuma escola cadastrada.</p>
              ) : (
                snapshot.schools.map((school) => (
                  <div key={school.id} className="rounded-app-sm border border-border p-3 mb-2">
                    <p className="text-[13px] font-bold text-ink">{school.name}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {[school.city, school.state].filter(Boolean).join(' - ') || 'Localidade não informada'}
                    </p>
                  </div>
                ))
              )}
            </div>

            {message && <p className="text-[12px] text-gm mb-3">{message}</p>}
            {error && <p className="text-[12px] text-[#C1440E] mb-3">{error}</p>}

            <button onClick={logout} className="w-full mb-6 py-2 rounded-app-sm border border-border text-[12px] font-bold text-muted flex items-center justify-center gap-2">
              <LogOut size={15} />
              Sair do aplicativo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return date.toLocaleDateString('pt-BR')
}

function formatSubscriptionStatus(status?: string | null) {
  switch (status) {
    case 'trial':
      return 'teste'
    case 'active':
      return 'ativa'
    case 'overdue':
      return 'em atraso'
    case 'blocked':
      return 'bloqueada'
    case 'canceled':
      return 'cancelada'
    default:
      return 'não definida'
  }
}

function formatProvider(provider?: string) {
  if (!provider) return 'manual'
  if (provider === 'mercado_pago') return 'Mercado Pago'
  if (provider === 'stripe') return 'Stripe'
  if (provider === 'manual') return 'Manual'
  return provider
}
