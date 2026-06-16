import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Copy, Eye, EyeOff, Gift, LogOut, Paperclip, Share2, ShieldCheck, Wallet, X } from 'lucide-react'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { useAppStore, useNavStore } from '@/store'
import { ensureTeacherSchool } from '@/services/supabase/classes'
import {
  buildVerificationNotes,
  formatVerificationNotesSummary,
  parseVerificationNotes,
  resolveApprovedVerificationDetails,
} from '@/utils/verification-notes'
import { saveDocumentStyleSettings } from '@/utils/document-style'
import {
  cancelTeacherSubscription,
  getTeacherAccountSnapshot,
  isTeacherAccessBlocked,
  logoutTeacher,
  peekTeacherAccountSnapshot,
  submitTeacherVerificationRequest,
  updateTeacherPassword,
  updateTeacherProfile,
  uploadTeacherVerificationDocuments,
  type TeacherAccountSnapshot,
} from '@/services/supabase/account'
import { APP_VERSION } from '@/version'
import { MOBILE_FILE_INPUT_CLASS } from '@/utils/device'
import { stashNavigationForFilePicker } from '@/utils/nav-session'
import { clearPendingFiles, loadPendingFiles, savePendingFiles } from '@/utils/pending-file-store'
import { buildReferralSignupUrl, buildReferralWhatsAppMessage } from '@/utils/referral'
import { EmailVerificationCard } from '@/components/ui/EmailVerificationNotice'
import { getSupabaseClient } from '@/services/supabase/client'
import { getEmailVerificationStateFromUser, resendSignupConfirmation } from '@/services/supabase/auth'
import type { EmailVerificationState } from '@/utils/email-verification'

const VERIFICATION_FILES_KEY = 'verification-pending'
const VERIFICATION_FILE_INPUT_ID = 'verification-file-input'

type ForcedAccountReason = 'subscription' | 'email' | null

function resolveForcedAccountReason(data: unknown): ForcedAccountReason {
  if (typeof data !== 'object' || !data) return null
  if ('forcedReason' in data) {
    const reason = (data as { forcedReason?: string }).forcedReason
    if (reason === 'email' || reason === 'subscription') return reason
  }
  if ('forcedMode' in data && (data as { forcedMode?: boolean }).forcedMode) return 'subscription'
  return null
}

export default function TeacherAccountSubscreen({ data }: { data?: unknown }) {
  const { closeSubscreen, subscreens } = useNavStore()
  const { setSchoolName, userId, teacherCode } = useAppStore()
  const forcedReason = resolveForcedAccountReason(data)
  const forcedMode = forcedReason != null
  const initialSnapshot =
    typeof data === 'object' && data && 'initialSnapshot' in data
      ? ((data as { initialSnapshot?: TeacherAccountSnapshot }).initialSnapshot ?? null)
      : null
  const verificationInputRef = useRef<HTMLInputElement | null>(null)
  const [snapshot, setSnapshot] = useState<TeacherAccountSnapshot | null>(
    () => initialSnapshot ?? peekTeacherAccountSnapshot(),
  )
  const [loading, setLoading] = useState(() => !initialSnapshot && !peekTeacherAccountSnapshot())
  const [saving, setSaving] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [referralMessage, setReferralMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [verificationSchoolName, setVerificationSchoolName] = useState('')
  const [verificationPeriod, setVerificationPeriod] = useState('')
  const [verificationObservation, setVerificationObservation] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [restoringPendingFiles, setRestoringPendingFiles] = useState(true)
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState | null>(null)
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('')
  const [emailVerificationError, setEmailVerificationError] = useState('')
  const [resendingEmailVerification, setResendingEmailVerification] = useState(false)

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
    const supabase = getSupabaseClient()
    if (!supabase) return () => { active = false }

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setEmailVerification(getEmailVerificationStateFromUser(data.user))
    })

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setEmailVerification(getEmailVerificationStateFromUser(nextSession?.user))
    })

    return () => {
      active = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (forcedReason === 'email' && emailVerification?.status === 'confirmed') {
      window.location.reload()
    }
  }, [emailVerification?.status, forcedReason])

  async function resendEmailVerification() {
    const targetEmail = email.trim() || snapshot?.email
    if (!targetEmail) return
    setResendingEmailVerification(true)
    setEmailVerificationMessage('')
    setEmailVerificationError('')
    try {
      await resendSignupConfirmation(targetEmail)
      setEmailVerificationMessage('Novo e-mail de confirmação enviado. Verifique também a caixa de spam.')
    } catch (error) {
      setEmailVerificationError(error instanceof Error ? error.message : 'Não foi possível reenviar o e-mail.')
    } finally {
      setResendingEmailVerification(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadPendingFiles(VERIFICATION_FILES_KEY)
      .then((files) => {
        if (!active || files.length === 0) return
        setPendingFiles(files)
      })
      .finally(() => {
        if (active) setRestoringPendingFiles(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadAccount(showBlockingLoader: boolean) {
      if (showBlockingLoader) setLoading(true)
      try {
        await refreshAccount()
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar sua conta.')
      } finally {
        if (active) setLoading(false)
      }
    }

    if (initialSnapshot) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    const hasCachedSnapshot = Boolean(peekTeacherAccountSnapshot())
    void loadAccount(!hasCachedSnapshot)
    return () => {
      active = false
    }
  }, [initialSnapshot])

  const blocked = useMemo(() => isTeacherAccessBlocked(snapshot?.subscription?.status ?? null), [snapshot])
  const showEmailForced = forcedReason === 'email'
  const showSubscriptionForced = forcedReason === 'subscription'
  const accountEmail = email.trim() || snapshot?.email || ''
  const showAccountSections = !showEmailForced
  const approvedVerification = useMemo(
    () => (snapshot?.verifications ?? []).find((item) => item.status === 'approved') ?? null,
    [snapshot],
  )
  const isProfileVerified = Boolean(approvedVerification)
  const approvedVerificationDetails = useMemo(
    () => resolveApprovedVerificationDetails(
      approvedVerification?.notes ?? null,
      snapshot?.schools ?? [],
    ),
    [approvedVerification, snapshot?.schools],
  )
  const approvedNeedsSchoolDetails = Boolean(
    isProfileVerified
    && approvedVerificationDetails
    && (
      /n[aã]o informad/i.test(approvedVerificationDetails.schoolName)
      || /n[aã]o informado/i.test(approvedVerificationDetails.period)
    ),
  )
  const hasPendingVerification = useMemo(
    () => (snapshot?.verifications ?? []).some((item) => item.status === 'pending'),
    [snapshot],
  )

  useEffect(() => {
    if (!approvedVerification || !snapshot) return
    const parsed = resolveApprovedVerificationDetails(approvedVerification.notes, snapshot.schools)
    if (!parsed?.schoolName || /n[aã]o informad/i.test(parsed.schoolName)) return
    setSchoolName(parsed.schoolName)
    saveDocumentStyleSettings({
      schoolName: parsed.schoolName,
      schoolPeriod: parsed.period,
      showSchoolNameInDocuments: true,
    })
  }, [approvedVerification, snapshot, setSchoolName])

  useEffect(() => {
    if (!snapshot || verificationSchoolName.trim()) return
    const pendingNotes = snapshot.verifications.find((item) => item.status === 'pending')?.notes ?? null
    const parsed = parseVerificationNotes(pendingNotes)
      ?? (isProfileVerified
        ? resolveApprovedVerificationDetails(approvedVerification?.notes ?? null, snapshot.schools)
        : null)
    if (parsed?.schoolName && !/n[aã]o informad/i.test(parsed.schoolName)) {
      setVerificationSchoolName(parsed.schoolName)
      setVerificationPeriod(parsed.period.includes('Não informado') ? '' : parsed.period)
      setVerificationObservation(parsed.observation ?? '')
      return
    }
    const firstSchool = snapshot.schools.find((school) => school.name?.trim() && !/n[aã]o informad/i.test(school.name))?.name
    if (firstSchool) setVerificationSchoolName(firstSchool)
  }, [snapshot, verificationSchoolName, isProfileVerified, approvedVerification])
  const submittedVerificationRequests = useMemo(
    () => (snapshot?.verifications ?? []).filter((item) => item.documents.length > 0),
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
      setMessage('Senha atualizada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  async function queueVerificationFiles(files: FileList | null) {
    if (!files?.length) return
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt']
    const rejected: string[] = []
    const sanitized = Array.from(files).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const validExtension = allowedExtensions.includes(extension)
      const validSize = file.size <= 15 * 1024 * 1024
      if (!validExtension) rejected.push(`${file.name} (formato não suportado)`)
      else if (!validSize) rejected.push(`${file.name} (acima de 15 MB)`)
      return validExtension && validSize
    })

    if (!sanitized.length) {
      setError(rejected[0] ? `Não foi possível anexar: ${rejected.join(', ')}` : 'Use arquivos PDF, imagem, DOC/DOCX ou TXT de até 15 MB.')
      return
    }

    stashNavigationForFilePicker('teacher-account', subscreens)
    const next = [...pendingFiles, ...sanitized].slice(-10)
    await savePendingFiles(VERIFICATION_FILES_KEY, next)
    setPendingFiles(next)
    setError('')
    setMessage(`${sanitized.length} arquivo(s) pronto(s) para envio. Toque em "Enviar comprovante para validação".`)
  }

  async function removePendingVerificationFile(index: number) {
    const next = pendingFiles.filter((_, itemIndex) => itemIndex !== index)
    await savePendingFiles(VERIFICATION_FILES_KEY, next)
    setPendingFiles(next)
  }

  async function saveVerifiedSchoolDetails() {
    if (!snapshot) return
    const schoolName = verificationSchoolName.trim()
    const period = verificationPeriod.trim()
    if (!schoolName || !period) {
      setError('Informe o nome da escola e o período de vínculo.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await ensureTeacherSchool(schoolName, userId || snapshot.userId)
      setSchoolName(schoolName)
      saveDocumentStyleSettings({
        schoolName,
        schoolPeriod: period,
        showSchoolNameInDocuments: true,
        showSchoolPeriodInDocuments: true,
      })
      await refreshAccount()
      setMessage('Escola e período salvos. Eles já aparecem nos documentos gerados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar escola e período.')
    } finally {
      setSaving(false)
    }
  }

  async function submitVerification() {
    if (!snapshot) return
    if (!pendingFiles.length) {
      setError('Anexe ao menos um documento para enviar a validação.')
      return
    }
    const schoolName = verificationSchoolName.trim()
    const period = verificationPeriod.trim()
    if (!schoolName) {
      setError('Informe o nome da escola em que você trabalha.')
      return
    }
    if (!period) {
      setError('Informe o período de vínculo com a escola.')
      return
    }

    setSubmittingVerification(true)
    setError('')
    try {
      const uploaded = await uploadTeacherVerificationDocuments(pendingFiles)
      const schoolId = await ensureTeacherSchool(schoolName, userId || snapshot.userId)
      const notes = buildVerificationNotes({
        schoolName,
        period,
        observation: verificationObservation.trim() || undefined,
      })
      await submitTeacherVerificationRequest({
        schoolIds: [schoolId],
        notes,
        documents: uploaded,
      })
      setSchoolName(schoolName)
      saveDocumentStyleSettings({
        schoolName,
        schoolPeriod: period,
        showSchoolNameInDocuments: true,
      })
      setPendingFiles([])
      await clearPendingFiles(VERIFICATION_FILES_KEY)
      setVerificationSchoolName('')
      setVerificationPeriod('')
      setVerificationObservation('')
      if (verificationInputRef.current) verificationInputRef.current.value = ''
      await refreshAccount()
      setMessage('Documentos enviados para validação com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a validação.')
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

  function onVerificationFileChange(event: ChangeEvent<HTMLInputElement>) {
    event.preventDefault()
    event.stopPropagation()
    void queueVerificationFiles(event.target.files)
    window.setTimeout(() => {
      event.target.value = ''
    }, 0)
  }

  const verificationFileInput = (
    <input
      ref={verificationInputRef}
      id={VERIFICATION_FILE_INPUT_ID}
      type="file"
      className={MOBILE_FILE_INPUT_CLASS}
      style={{ position: 'fixed', top: 0, left: 0 }}
      tabIndex={-1}
      aria-hidden="true"
      multiple
      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,application/pdf,image/*"
      disabled={submittingVerification || restoringPendingFiles}
      onChange={onVerificationFileChange}
    />
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      {typeof document !== 'undefined' ? createPortal(verificationFileInput, document.body) : verificationFileInput}
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
            {forcedMode && (
              <div className="bg-[#FFF3CD] border border-[#F2D58B] rounded-app p-4 mb-4">
                <p className="text-[13px] font-bold text-[#856404]">
                  {showEmailForced ? 'Confirme seu e-mail para continuar' : 'Regularize sua assinatura para continuar'}
                </p>
                <p className="text-[12px] text-[#856404] mt-1 leading-[1.5]">
                  {showEmailForced
                    ? 'Seu acesso está pausado até a confirmação do e-mail cadastrado.'
                    : 'Seu acesso está restrito por pendência de pagamento ou assinatura cancelada.'}
                </p>
              </div>
            )}

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-3">Perfil da professora</p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink truncate">{snapshot.fullName}</p>
                  <p className="text-[11px] text-muted mt-1">Professora</p>
                  {isProfileVerified && approvedVerificationDetails?.schoolName && (
                    <p className="text-[11px] text-gm mt-1 font-bold truncate">
                      {approvedVerificationDetails.schoolName}
                    </p>
                  )}
                </div>
                {isProfileVerified && <VerifiedBadge />}
              </div>
            </div>

            {emailVerification && accountEmail && (
              <EmailVerificationCard
                email={accountEmail}
                state={emailVerification}
                sending={resendingEmailVerification}
                message={emailVerificationMessage}
                error={emailVerificationError}
                onResend={() => void resendEmailVerification()}
                compact={showEmailForced}
              />
            )}

            {showAccountSections && (
              <ReferralCard
                teacherCode={snapshot.referrals?.teacherCode ?? teacherCode}
                referrals={snapshot.referrals}
                onMessage={setReferralMessage}
              />
            )}

            {showAccountSections && (
            <div className="bg-white rounded-app p-4 border border-gp shadow-card mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-gm" />
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Validação profissional</p>
                </div>
                {isProfileVerified && <VerifiedBadge compact />}
              </div>

              {isProfileVerified && approvedVerificationDetails && !approvedNeedsSchoolDetails ? (
                <div className="rounded-app-sm border border-gp bg-gbg px-3 py-3">
                  <p className="text-[12px] font-bold text-gd">Vínculo com a escola confirmado</p>
                  <p className="text-[12px] text-ink mt-2">
                    <span className="font-bold">Escola:</span> {approvedVerificationDetails.schoolName}
                  </p>
                  <p className="text-[12px] text-ink mt-1">
                    <span className="font-bold">Período:</span> {approvedVerificationDetails.period}
                  </p>
                  {approvedVerificationDetails.observation && (
                    <p className="text-[11px] text-muted mt-2 leading-[1.5]">
                      {approvedVerificationDetails.observation}
                    </p>
                  )}
                  <p className="text-[11px] text-muted mt-3 leading-[1.5]">
                    O nome da escola já aparece automaticamente nos documentos gerados. Você pode ajustar a exibição em
                    {' '}
                    <span className="font-bold text-gd">Criador Pedagógico → Edição e Formatação</span>.
                  </p>
                </div>
              ) : isProfileVerified && approvedNeedsSchoolDetails ? (
                <>
                  <div className="rounded-app-sm border border-gp bg-gbg px-3 py-3 mb-3">
                    <p className="text-[12px] font-bold text-gd">Perfil verificado pela equipe Approf</p>
                    <p className="text-[11px] text-muted mt-2 leading-[1.5]">
                      Complete o nome da escola e o período de vínculo para que essas informações apareçam nos seus
                      relatórios e planejamentos.
                    </p>
                  </div>
                  <label className="block text-[11px] font-bold text-muted">Nome da escola em que trabalha</label>
                  <input
                    value={verificationSchoolName}
                    onChange={(event) => setVerificationSchoolName(event.target.value)}
                    placeholder="Ex: EMEI Professora Maria Silva"
                    className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]"
                  />
                  <label className="block text-[11px] font-bold text-muted">Período de vínculo</label>
                  <input
                    value={verificationPeriod}
                    onChange={(event) => setVerificationPeriod(event.target.value)}
                    placeholder="Ex: mar/2025 a dez/2025"
                    className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => void saveVerifiedSchoolDetails()}
                    disabled={saving || !verificationSchoolName.trim() || !verificationPeriod.trim()}
                    className="w-full py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar escola e período'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-muted leading-[1.5]">
                    Comprove que você trabalha em uma escola informando o nome da instituição, o período de vínculo e
                    enviando um comprovante como holerite, declaração da escola ou contrato.
                  </p>
                  {hasPendingVerification && (
                    <p className="mt-3 rounded-app-sm border border-[#EAD58A] bg-[#FFF8D8] px-3 py-2 text-[11px] leading-[1.5] text-[#856404]">
                      Seus documentos estão em análise. A equipe Approf revisará o comprovante enviado.
                    </p>
                  )}
                  <label className="block mt-3 text-[11px] font-bold text-muted">Nome da escola em que trabalha</label>
                  <input
                    value={verificationSchoolName}
                    onChange={(event) => setVerificationSchoolName(event.target.value)}
                    placeholder="Ex: EMEI Professora Maria Silva"
                    className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]"
                    disabled={hasPendingVerification}
                  />
                  <label className="block text-[11px] font-bold text-muted">Período de vínculo</label>
                  <input
                    value={verificationPeriod}
                    onChange={(event) => setVerificationPeriod(event.target.value)}
                    placeholder="Ex: mar/2025 a dez/2025"
                    className="w-full mt-1 mb-3 rounded-app-sm border border-border px-3 py-2 text-[13px]"
                    disabled={hasPendingVerification}
                  />
                  <label className="block text-[11px] font-bold text-muted">Observação (opcional)</label>
                  <textarea
                    value={verificationObservation}
                    onChange={(event) => setVerificationObservation(event.target.value)}
                    placeholder="Informações adicionais para a equipe de validação."
                    className="w-full mt-1 min-h-[72px] rounded-app-sm border border-border px-3 py-2 text-[12px]"
                    disabled={hasPendingVerification}
                  />
                  <p className="text-[11px] text-muted mt-3 leading-[1.5]">
                    Anexe o comprovante de vínculo (holerite, declaração da escola, contrato ou documento equivalente).
                  </p>
                  <label
                    htmlFor={VERIFICATION_FILE_INPUT_ID}
                    onClick={() => stashNavigationForFilePicker('teacher-account', subscreens)}
                    className={`w-full mt-3 inline-flex items-center justify-center gap-2 py-2 rounded-app-sm border border-gp text-gd text-[12px] font-bold cursor-pointer ${submittingVerification || restoringPendingFiles || hasPendingVerification ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <Paperclip size={14} />
                    {restoringPendingFiles ? 'Recuperando anexos...' : 'Anexar comprovante'}
                  </label>
                  {pendingFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-bold text-ink">Comprovantes prontos para envio</p>
                      {pendingFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-app-sm border border-border bg-cream px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-ink truncate">{file.name}</p>
                            <p className="text-[10px] text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingVerificationFile(index)}
                            className="w-7 h-7 rounded-full border border-border bg-white flex items-center justify-center text-muted flex-shrink-0"
                            aria-label={`Remover ${file.name}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void submitVerification()}
                    disabled={
                      submittingVerification
                      || hasPendingVerification
                      || pendingFiles.length === 0
                      || !verificationSchoolName.trim()
                      || !verificationPeriod.trim()
                    }
                    className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50"
                  >
                    {submittingVerification ? 'Enviando comprovante...' : 'Enviar comprovante para validação'}
                  </button>
                </>
              )}

              {submittedVerificationRequests.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-muted mb-2">Histórico de envios</p>
                  {submittedVerificationRequests.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-app-sm border border-border p-3 mb-2">
                      <p className="text-[12px] font-bold text-ink">
                        Status: {formatVerificationStatus(item.status)}
                      </p>
                      <p className="text-[11px] text-muted mt-1">
                        {item.documents.length} documento(s) enviado(s) em {formatDate(item.created_at)}
                      </p>
                      {formatVerificationNotesSummary(item.notes) && (
                        <p className="text-[11px] text-soft mt-1 leading-[1.5]">
                          {formatVerificationNotesSummary(item.notes)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {showAccountSections && blocked && (
              <div className="bg-[#FFF3CD] border border-[#F2D58B] rounded-app p-4 mb-4">
                <p className="text-[13px] font-bold text-[#856404]">Acesso restrito pelo admin</p>
                <p className="text-[12px] text-[#856404] mt-1 leading-[1.5]">
                  Sua conta foi bloqueada manualmente pela equipe. Entre em contato para regularizar o acesso.
                </p>
              </div>
            )}

            {showAccountSections && (
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
            )}

            {showAccountSections && (
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
            )}

            {(showSubscriptionForced || showAccountSections) && (
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} className="text-gm" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Assinatura</p>
              </div>
              <p className="text-[13px] font-bold text-ink">Status: {formatSubscriptionStatus(snapshot.subscription?.status)}</p>
              <p className="text-[12px] text-muted mt-1">Plano escolhido: {formatSubscriptionPlan(snapshot.subscription?.plan)}</p>
              {snapshot.subscription?.status === 'trial' ? (
                <>
                  <p className="text-[12px] text-muted mt-1">
                    Teste gratuito até: {formatDate(snapshot.subscription.trialExpiresAt ?? snapshot.subscription.currentPeriodEnd)}
                  </p>
                  <p className="text-[12px] text-muted mt-1">Cobrança após o teste: {formatSubscriptionPrice(snapshot.subscription.plan)}</p>
                </>
              ) : (
                <p className="text-[12px] text-muted mt-1">
                  {formatSubscriptionDateLabel(snapshot.subscription?.status)}: {formatDate(snapshot.subscription?.currentPeriodEnd)}
                </p>
              )}
              {getPaymentUrl(snapshot.subscription?.externalReference) && (
                <a
                  href={getPaymentUrl(snapshot.subscription?.externalReference) ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold flex items-center justify-center"
                >
                  Abrir link de pagamento
                </a>
              )}
              <button onClick={requestCancellation} disabled={saving || blocked} className="w-full mt-3 py-2 rounded-app-sm border border-[#C1440E] text-[#C1440E] text-[12px] font-bold disabled:opacity-50">
                {blocked ? 'Assinatura já restrita' : 'Cancelar assinatura'}
              </button>
            </div>
            )}

            {message && <p className="text-[12px] text-gm mb-3">{message}</p>}
            {referralMessage && <p className="text-[12px] text-gm mb-3">{referralMessage}</p>}
            {error && <p className="text-[12px] text-[#C1440E] mb-3">{error}</p>}

            <button onClick={logout} className="w-full mb-6 py-2 rounded-app-sm border border-border text-[12px] font-bold text-muted flex items-center justify-center gap-2">
              <LogOut size={15} />
              Sair do aplicativo
            </button>

            <div className="mb-8 text-center">
              <p className="text-[11px] text-muted">Approf v{APP_VERSION}</p>
              <p className="text-[11px] text-muted mt-1">
                <a href={`${import.meta.env.VITE_APPROF_SITE_URL ?? 'https://approf.com.br'}/termos`} target="_blank" rel="noopener noreferrer" className="underline">Termos de uso</a> · <a href={`${import.meta.env.VITE_APPROF_SITE_URL ?? 'https://approf.com.br'}/privacidade`} target="_blank" rel="noopener noreferrer" className="underline">Privacidade</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReferralCard({
  teacherCode,
  referrals,
  onMessage,
}: {
  teacherCode: string
  referrals: TeacherAccountSnapshot['referrals']
  onMessage: (message: string) => void
}) {
  const code = teacherCode?.trim()
  const referralLink = code ? buildReferralSignupUrl(code) : ''
  const stats = referrals?.stats ?? { registered: 0, converted: 0, rewarded: 0 }
  const availableCredit = (referrals?.availableCreditCents ?? 0) / 100
  const totalGiz = referrals?.totalGiztokensEarned ?? 0
  const history = referrals?.history ?? []

  async function copyLink() {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      onMessage('Link de indicação copiado.')
    } catch {
      onMessage('Não foi possível copiar o link agora.')
    }
  }

  function shareWhatsApp() {
    if (!referralLink) return
    const url = `https://wa.me/?text=${encodeURIComponent(buildReferralWhatsAppMessage(referralLink))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={15} className="text-gm" />
        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Indique uma prof</p>
      </div>
      <p className="text-[12px] text-soft leading-[1.6]">
        Compartilhe seu link. Quando uma colega assinar, você ganha desconto na próxima mensalidade e GizTokens extras.
      </p>
      <div className="mt-3 rounded-app-sm border border-border bg-cream px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Seu código</p>
        <p className="text-[13px] font-bold text-ink mt-1">{code || 'Gerando código...'}</p>
        {referralLink && (
          <p className="text-[11px] text-muted mt-2 break-all">{referralLink}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={!referralLink}
          className="inline-flex items-center justify-center gap-1 rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[11px] font-bold text-gd disabled:opacity-50"
        >
          <Copy size={13} />
          Copiar link
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          disabled={!referralLink}
          className="inline-flex items-center justify-center gap-1 rounded-app-sm bg-gm px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
        >
          <Share2 size={13} />
          WhatsApp
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-app-sm border border-border bg-white px-2 py-2">
          <p className="text-[14px] font-bold text-ink">{stats.registered}</p>
          <p className="text-[10px] text-muted">Cadastros</p>
        </div>
        <div className="rounded-app-sm border border-border bg-white px-2 py-2">
          <p className="text-[14px] font-bold text-ink">{stats.rewarded}</p>
          <p className="text-[10px] text-muted">Recompensas</p>
        </div>
        <div className="rounded-app-sm border border-border bg-white px-2 py-2">
          <p className="text-[14px] font-bold text-gd">{formatCurrency(availableCredit)}</p>
          <p className="text-[10px] text-muted">Crédito</p>
        </div>
      </div>
      <p className="text-[11px] text-muted mt-3 leading-[1.5]">
        Bônus por indicação convertida: plano mensal = R$ 10,00 + 1.000 GizTokens · plano anual = R$ 36,90 + 2.000 GizTokens.
        {totalGiz > 0 && (
          <>
            {' '}
            Você já ganhou
            {' '}
            <strong>{totalGiz.toLocaleString('pt-BR')} GizTokens</strong>
            .
          </>
        )}
      </p>
      {history.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Histórico</p>
          <div className="flex flex-col gap-2">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-app-sm border border-border bg-cream px-3 py-2">
                <p className="text-[12px] font-bold text-ink">{item.referredName}</p>
                <p className="text-[10px] text-muted mt-0.5">{formatReferralStatus(item.status)}</p>
                {item.status === 'rewarded' && (
                  <p className="text-[10px] text-gd mt-1">
                    +{formatCurrency(item.creditCents / 100)} · +{item.giztokensBonus.toLocaleString('pt-BR')} Giz
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatReferralStatus(status: string) {
  if (status === 'registered') return 'Cadastrou pelo seu link'
  if (status === 'converted') return 'Assinatura convertida'
  if (status === 'rewarded') return 'Recompensa liberada'
  return 'Indicação inválida'
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
      return 'Teste gratuito ativo'
    case 'active':
      return 'Assinatura ativa'
    case 'overdue':
      return 'Pagamento em atraso'
    case 'blocked':
      return 'Acesso bloqueado'
    case 'canceled':
      return 'Assinatura cancelada'
    default:
      return 'Assinatura não configurada'
  }
}

function formatSubscriptionDateLabel(status?: string | null) {
  if (status === 'overdue') return 'Pagamento pendente desde'
  if (status === 'canceled') return 'Acesso disponível até'
  if (status === 'blocked') return 'Bloqueado desde'
  return 'Próximo vencimento'
}

function formatSubscriptionPlan(plan?: string | null) {
  if (!plan) return 'Não identificado'
  const normalized = plan.trim().toLowerCase()
  if (['monthly', 'mensal', 'month', 'mês', 'trial', 'teste', 'trial_7_days', 'trial_15_days'].includes(normalized)) return 'Mensal'
  if (['semiannual', 'semestral', 'semi-annual'].includes(normalized)) return 'Semestral'
  if (['annual', 'anual', 'yearly', 'ano'].includes(normalized)) return 'Anual'
  return plan
}

function formatSubscriptionPrice(plan?: string | null) {
  const normalized = plan?.trim().toLowerCase()
  if (normalized && ['annual', 'anual', 'yearly', 'ano'].includes(normalized)) {
    return 'Cobrança única de R$ 358,80 por ano (após o teste de 7 dias)'
  }
  if (normalized && ['semiannual', 'semestral', 'semi-annual'].includes(normalized)) {
    return 'Cobrança única de R$ 209,40 a cada 6 meses (após o teste de 7 dias)'
  }
  return 'R$ 39,90 por mês (após o teste de 7 dias)'
}

function getPaymentUrl(value?: string | null) {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : null
}

function formatVerificationStatus(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') return 'Validação aprovada'
  if (status === 'rejected') return 'Validação recusada'
  return 'Aguardando revisão da equipe'
}
