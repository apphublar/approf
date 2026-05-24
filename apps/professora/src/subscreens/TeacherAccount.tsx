import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronLeft, Eye, EyeOff, ImagePlus, LogOut, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { useNavStore } from '@/store'
import {
  cancelTeacherSubscription,
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  logoutTeacher,
  submitTeacherVerificationRequest,
  updateTeacherPassword,
  updateTeacherProfile,
  uploadTeacherAvatar,
  uploadTeacherVerificationDocuments,
  type TeacherAccountSnapshot,
} from '@/services/supabase/account'
import { getAdjustedPhotoStyle, parsePhotoAdjustment, serializePhotoAdjustment } from '@/utils/photo'

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarPositionX, setAvatarPositionX] = useState(() => getStoredAvatarAdjustment().x)
  const [avatarPositionY, setAvatarPositionY] = useState(() => getStoredAvatarAdjustment().y)
  const [avatarZoom, setAvatarZoom] = useState(() => getStoredAvatarAdjustment().zoom)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('approf:biometric-enabled') === '1'
  })
  const [verificationNotes, setVerificationNotes] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  async function refreshAccount() {
    const account = await getTeacherAccountSnapshot({ forceRefresh: true })
    setSnapshot(account)
    setFullName(account.fullName)
    setPhone(account.phone ?? '')
    setEmail(account.email ?? '')
    setAvatarUrl(account.avatarUrl ?? null)
  }

  useEffect(() => {
    if (!initialSnapshot) return
    setFullName(initialSnapshot.fullName)
    setPhone(initialSnapshot.phone ?? '')
    setEmail(initialSnapshot.email ?? '')
    setAvatarUrl(initialSnapshot.avatarUrl ?? null)
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

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  const blocked = useMemo(() => isTeacherAccessBlocked(snapshot?.subscription?.status ?? null), [snapshot])
  const isProfileVerified = useMemo(
    () => (snapshot?.verifications ?? []).some((item) => item.status === 'approved'),
    [snapshot],
  )
  const verificationPending = useMemo(
    () => (snapshot?.verifications ?? []).some((item) => item.status === 'pending'),
    [snapshot],
  )
  const canUploadAvatar = Boolean(avatarFile)
  const displayedAvatar = avatarPreviewUrl ?? avatarUrl

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
      setMessage('Senha atualizada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  function queueAvatar(file?: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida para foto de perfil.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 8 MB.')
      return
    }
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
    setError('')
    setMessage('')
  }

  async function saveAvatar() {
    if (!avatarFile) return
    setSaving(true)
    setError('')
    try {
      const adjustment = { x: avatarPositionX, y: avatarPositionY, zoom: avatarZoom }
      const adjustedFile = await buildAdjustedAvatarFile(avatarFile, adjustment)
      const uploadedUrl = await uploadTeacherAvatar(adjustedFile)
      await updateTeacherProfile({ avatarUrl: uploadedUrl })
      setAvatarFile(null)
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
      setAvatarPreviewUrl(null)
      setAvatarUrl(uploadedUrl)
      saveAvatarAdjustment(adjustment)
      await refreshAccount()
      setMessage('Foto de perfil atualizada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar sua foto.')
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
        <span className="font-serif text-[18px] text-gd flex-1">Minha conta</span>
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
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gbg border border-gp flex items-center justify-center text-gd font-bold overflow-hidden">
                  {displayedAvatar ? (
                    <img
                      src={displayedAvatar}
                      alt="Foto da professora"
                      className="w-full h-full object-cover"
                      style={getAdjustedPhotoStyle(serializePhotoAdjustment({ x: avatarPositionX, y: avatarPositionY, zoom: avatarZoom }))}
                    />
                  ) : (
                    initialsFromName(snapshot.fullName)
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-ink">{snapshot.fullName}</p>
                  <p className="text-[11px] text-muted">Perfil profissional</p>
                  <div className="mt-1 inline-flex items-center gap-1.5">
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
                <ImagePlus size={16} className="text-muted" />
              </div>
              {displayedAvatar && (
                <div className="mt-4 space-y-3">
                  <PhotoPositionSlider label="Zoom" min={100} max={240} value={avatarZoom} onChange={setAvatarZoom} />
                  <PhotoPositionSlider label="Mover para os lados" value={avatarPositionX} onChange={setAvatarPositionX} />
                  <PhotoPositionSlider label="Mover para cima/baixo" value={avatarPositionY} onChange={setAvatarPositionY} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <label className="inline-flex items-center justify-center py-2 rounded-app-sm border border-gp text-gd text-[12px] font-bold cursor-pointer">
                  Escolher foto
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(event) => queueAvatar(event.target.files?.[0])}
                  />
                </label>
                <button
                  onClick={saveAvatar}
                  disabled={!canUploadAvatar || saving}
                  className="py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50"
                >
                  {saving && canUploadAvatar ? 'Salvando...' : 'Salvar foto'}
                </button>
              </div>
              <p className="text-[11px] text-muted mt-3">
                Escolha a imagem, ajuste o enquadramento e salve a foto final do perfil.
              </p>
            </div>

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
              <label className="text-[11px] text-muted">E-mail</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]" />
              <button onClick={saveProfile} disabled={saving} className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </button>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Senha e segurança</p>
              <label className="text-[11px] text-muted">Senha atual</label>
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
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Acesso do aplicativo</p>
              <label className="flex items-center justify-between mt-1 text-[12px] text-muted">
                <span>Desbloqueio biométrico</span>
                <input
                  type="checkbox"
                  checked={biometricEnabled}
                  onChange={(event) => {
                    const next = event.target.checked
                    setBiometricEnabled(next)
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('approf:biometric-enabled', next ? '1' : '0')
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-muted mt-2">
                Esta opção controla o acesso rápido ao app e funciona separadamente da troca de senha.
              </p>
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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'PR'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function getStoredAvatarAdjustment() {
  if (typeof window === 'undefined') return parsePhotoAdjustment(null)
  return parsePhotoAdjustment(window.localStorage.getItem('approf:teacher-avatar-adjustment'))
}

function saveAvatarAdjustment(adjustment: { x: number; y: number; zoom: number }) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('approf:teacher-avatar-adjustment', serializePhotoAdjustment(adjustment))
}

async function buildAdjustedAvatarFile(file: File, adjustment: { x: number; y: number; zoom: number }) {
  const imageUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(imageUrl)
    const size = 640
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a imagem.')

    const scale = adjustment.zoom / 100
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    const offsetX = size / 2 - (adjustment.x / 100) * drawWidth
    const offsetY = size / 2 - (adjustment.y / 100) * drawHeight
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('Não foi possível finalizar a foto.')
    return new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'))
    image.src = src
  })
}

function PhotoPositionSlider({
  label,
  min = 0,
  max = 100,
  value,
  onChange,
}: {
  label: string
  min?: number
  max?: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-2">
        <span>{label}</span>
        <span>{value}%</span>
      </span>
      <input
        className="w-full accent-gm"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
