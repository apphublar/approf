import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronLeft, Eye, EyeOff, LogOut, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { useNavStore } from '@/store'
import {
  cancelTeacherSubscription,
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  logoutTeacher,
  submitTeacherVerificationRequest,
  updateTeacherPassword,
  updateTeacherProfile,
  uploadTeacherVerificationDocuments,
  type TeacherAccountSnapshot,
} from '@/services/supabase/account'

export default function TeacherAccountSubscreen({ data }: { data?: unknown }) {
  const { closeSubscreen } = useNavStore()
  const forcedMode = typeof data === 'object' && data && 'forcedMode' in data
    ? Boolean((data as { forcedMode?: boolean }).forcedMode)
    : false
  const initialSnapshot =
    typeof data === 'object' && data && 'initialSnapshot' in data
      ? ((data as { initialSnapshot?: TeacherAccountSnapshot }).initialSnapshot ?? null)
      : null
  const [snapshot, setSnapshot] = useState<TeacherAccountSnapshot | null>(initialSnapshot)
  const [loading, setLoading] = useState(!initialSnapshot)
  const [saving, setSaving] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  async function refreshAccount() {
    const account = await getTeacherAccountSnapshot({ forceRefresh: true })
    setSnapshot(account)
    setFullName(account.fullName)
    setPhone(account.phone ?? '')
    setEmail(account.email ?? '')
  }

  useEffect(() => {
    if (!initialSnapshot) return
    setFullName(initialSnapshot.fullName)
    setPhone(initialSnapshot.phone ?? '')
    setEmail(initialSnapshot.email ?? '')
  }, [initialSnapshot])

  useEffect(() => {
    let active = true
    if (!initialSnapshot) setLoading(true)
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
  }, [initialSnapshot])

  const blocked = useMemo(() => isTeacherAccessBlocked(snapshot?.subscription?.status ?? null), [snapshot])
  const isProfileVerified = useMemo(
    () => (snapshot?.verifications ?? []).some((item) => item.status === 'approved'),
    [snapshot],
  )
  const verificationPending = useMemo(
    () => (snapshot?.verifications ?? []).some((item) => item.status === 'pending'),
    [snapshot],
  )
  async function saveProfile() {
    if (!snapshot) return
    setSaving(true)
    setError('')
    try {
      await updateTeacherProfile({ fullName: fullName.trim(), phone: phone.trim() || null })
      if (email.trim() !== (snapshot.email ?? '').trim()) {
        await updateTeacherProfile({ email: email.trim() })
      }
      await refreshAccount()
      setMessage('Cadastro atualizado com sucesso. Se o e-mail mudou, confirme no novo endereço.')
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

  async function savePassword() {
    if (!snapshot) return
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateTeacherPassword({
        email: snapshot.email,
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Senhá atualizada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  function queueVerificationFiles(files: FileList | null) {
    if (!files?.length) return
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt']
    const sanitized = Array.from(files).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const validExtension = allowedExtensions.includes(extension)
      const validSize = file.size <= 15 * 1024 * 1024
      return validExtension && validSize
    })

    if (!sanitized.length) {
      setError('Use arquivos PDF, imagem, DOC/DOCX ou TXT de até 15 MB.')
      return
    }
    setPendingFiles((current) => [...current, ...sanitized].slice(-10))
    setError('')
  }

  async function submitVerification() {
    if (!snapshot) return
    if (!pendingFiles.length) {
      setError('Anexe ao menos um documento para enviar a verificação.')
      return
    }
    if (snapshot.schools.length === 0) {
      setError('Cadastre ao menos uma escola antes de solicitar a verificação do perfil.')
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
        <span className="font-serif text-[18px] text-gd flex-1">Minhá conta</span>
      </div>

      <div className="scroll-area px-[18px] py-4">
        {loading ? (
          <div className="bg-white rounded-app p-4 border border-border text-[12px] text-muted">Carregando conta...</div>
        ) : !snapshot ? (
          <div className="bg-white rounded-app p-4 border border-red-200 text-[12px] text-red-700">{error || 'Conta indisponível.'}</div>
        ) : (
          <>
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Perfil da professora</p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink truncate">{snapshot.fullName}</p>
                  <p className="text-[11px] text-muted mt-1">Professora</p>
                </div>
                <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                    {isProfileVerified ? (
                      <>
                        <BadgeCheck size={14} className="text-gm" />
                        <span className="text-[11px] text-gm font-bold">Perfil verificado</span>
                      </>
                    ) : verificationPending ? (
                      <>
                        <ShieldAlert size={14} className="text-[#856404]" />
                        <span className="text-[11px] text-[#856404] font-bold">Verificação em análise</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} className="text-muted" />
                        <span className="text-[11px] text-muted font-bold">Perfil não verificado</span>
                      </>
                    )}
                  </div>
              </div>
            </div>

            {blocked && (
              <div className="bg-[#FFF3CD] border border-[#F2D58B] rounded-app p-4 mb-4">
                <p className="text-[13px] font-bold text-[#856404]">Acesso restrito pelo admin</p>
                <p className="text-[12px] text-[#856404] mt-1 leading-[1.5]">
                  Sua conta foi bloqueada manualmente pela equipe. Entre em contato para regularizar o acesso.
                </p>
              </div>
            )}

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Cadastro</p>
              <label className="text-[11px] text-muted">Nome completo</label>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <label className="text-[11px] text-muted">Telefone</label>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <label className="text-[11px] text-muted">E-mail</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <button onClick={saveProfile} disabled={saving} className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </button>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Senhá e segurança</p>
              <label className="text-[11px] text-muted">Senhá atual</label>
              <div className="relative mt-1 mb-3">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-2 pr-10 text-[13px]"
                />
                <button type="button" onClick={() => setShowCurrentPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                  {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <label className="text-[11px] text-muted">Nova senha</label>
              <div className="relative mt-1 mb-3">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-2 pr-10 text-[13px]"
                />
                <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <label className="text-[11px] text-muted">Confirmar nova senha</label>
              <div className="relative mt-1 mb-3">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-app-sm border border-border px-3 py-2 pr-10 text-[13px]"
                />
                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                  {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={savePassword} disabled={saving} className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Atualizar senha'}
              </button>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} className="text-gm" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Assinatura</p>
              </div>
              <p className="text-[13px] font-bold text-ink">Status: {formatSubscriptionStatus(snapshot.subscription?.status)}</p>
              <p className="text-[12px] text-muted mt-1">Plano: {formatSubscriptionPlan(snapshot.subscription?.plan, snapshot.subscription?.status)}</p>
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
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                  onChange={(event) => queueVerificationFiles(event.target.files)}
                />
              </label>
              {pendingFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pendingFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted">
                        {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                      </p>
                      <button
                        onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-[11px] text-[#C1440E] font-bold"
                      >
                        remover
                      </button>
                    </div>
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

            <div className="mb-8 text-center">
              <p className="text-[11px] text-muted">Approf v1.0.0</p>
              <p className="text-[11px] text-muted mt-1">
                <a href="#" className="underline">Termos de uso</a> · <a href="#" className="underline">Privacidade</a>
              </p>
            </div>
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

function formatSubscriptionPlan(plan?: string | null, status?: string | null) {
  if (status === 'trial') return 'Plano teste'
  if (!plan) return 'Não identificado'
  const normalized = plan.trim().toLowerCase()
  if (['monthly', 'mensal', 'month', 'mês'].includes(normalized)) return 'Mensal'
  if (['annual', 'anual', 'yearly', 'ano'].includes(normalized)) return 'Anual'
  if (['trial', 'teste'].includes(normalized)) return 'Plano teste'
  return plan
}
