import { MailCheck, MailWarning } from 'lucide-react'
import {
  formatEmailVerificationCountdown,
  formatEmailVerificationDeadline,
  type EmailVerificationState,
} from '@/utils/email-verification'

interface EmailVerificationBannerProps {
  email: string
  state: EmailVerificationState
  sending: boolean
  message: string
  onResend: () => void
}

export default function EmailVerificationBanner({
  email,
  state,
  sending,
  message,
  onResend,
}: EmailVerificationBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[220] bg-[#FFF3CD] border-b border-[#F2D58B] px-4 py-3 shadow-sm">
      <div className="max-w-[560px] mx-auto flex items-start gap-3">
        <MailWarning size={18} className="text-[#856404] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#856404]">Confirme seu e-mail para manter o acesso</p>
          <p className="text-[12px] text-[#856404] mt-1 leading-[1.5]">
            Enviamos um link para <strong>{email}</strong>. Você tem até{' '}
            {formatEmailVerificationDeadline(state.deadline)} ({formatEmailVerificationCountdown(state.msRemaining)} restantes).
          </p>
          {message && <p className="text-[12px] text-gd mt-1">{message}</p>}
        </div>
        <button
          type="button"
          onClick={onResend}
          disabled={sending}
          className="flex-shrink-0 rounded-app-sm bg-[#856404] text-white text-[11px] font-bold px-3 py-2 disabled:opacity-60"
        >
          {sending ? 'Enviando...' : 'Reenviar'}
        </button>
      </div>
    </div>
  )
}

interface EmailVerificationCardProps {
  email: string
  state: EmailVerificationState
  sending: boolean
  message: string
  error: string
  onResend: () => void
  compact?: boolean
}

export function EmailVerificationCard({
  email,
  state,
  sending,
  message,
  error,
  onResend,
  compact = false,
}: EmailVerificationCardProps) {
  const confirmed = state.status === 'confirmed'
  const blocked = state.status === 'blocked'

  return (
    <div className={`rounded-app p-4 border shadow-card mb-4 ${blocked ? 'bg-[#FFF3CD] border-[#F2D58B]' : 'bg-white border-border'}`}>
      <div className="flex items-center gap-2 mb-3">
        {confirmed ? <MailCheck size={15} className="text-gm" /> : <MailWarning size={15} className={blocked ? 'text-[#856404]' : 'text-gm'} />}
        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">Validação de e-mail</p>
      </div>

      {confirmed ? (
        <>
          <p className="text-[13px] font-bold text-ink">E-mail confirmado</p>
          <p className="text-[12px] text-muted mt-1">{email}</p>
        </>
      ) : (
        <>
          <p className={`text-[13px] font-bold ${blocked ? 'text-[#856404]' : 'text-ink'}`}>
            {blocked ? 'Confirme seu e-mail para recuperar o acesso' : 'Confirme seu e-mail'}
          </p>
          <p className={`text-[12px] mt-1 leading-[1.5] ${blocked ? 'text-[#856404]' : 'text-muted'}`}>
            {blocked
              ? 'O prazo de 24 horas expirou. Reenvie o link de confirmação e clique nele para liberar sua conta.'
              : `Enviamos um link para ${email}. Confirme até ${formatEmailVerificationDeadline(state.deadline)} para evitar bloqueio.`}
          </p>
          {!compact && !blocked && (
            <p className="text-[11px] text-soft mt-2">
              Tempo restante: {formatEmailVerificationCountdown(state.msRemaining)}
            </p>
          )}
          <button
            type="button"
            onClick={onResend}
            disabled={sending}
            className="w-full mt-3 py-2 rounded-app-sm bg-gm text-white text-[12px] font-bold disabled:opacity-50"
          >
            {sending ? 'Reenviando e-mail...' : 'Reenviar e-mail de confirmação'}
          </button>
          {message && <p className="text-[12px] text-gm mt-2">{message}</p>}
          {error && <p className="text-[12px] text-[#C1440E] mt-2">{error}</p>}
        </>
      )}
    </div>
  )
}
