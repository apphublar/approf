import { useState } from 'react'
import { ChevronLeft, MoveRight, ShieldCheck } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { getAppDataMode } from '@/services/app-data'
import { loadTeacherWorkspace } from '@/services/supabase/classes'
import { submitContinuityRequest } from '@/services/continuity'

export default function TransferStudentSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeClassId, activeStudentId, teacherCode, hydrateWorkspace } = useAppStore()
  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const student = cls?.students.find((item) => item.id === activeStudentId) ?? cls?.students[0]
  const otherClasses = classes.filter((item) => item.id !== cls?.id)

  const [mode, setMode] = useState<'teacher' | 'class'>('teacher')
  const [targetTeacherCode, setTargetTeacherCode] = useState('')
  const [targetClassId, setTargetClassId] = useState(otherClasses[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!cls || !student) return null

  async function transfer() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (getAppDataMode() !== 'supabase') {
        setMessage('Transferência registrada no modo demonstração.')
        return
      }

      const result = await submitContinuityRequest({
        requestType: mode === 'class' ? 'transfer_class' : 'transfer_teacher',
        studentId: student.id,
        targetClassId: mode === 'class' ? targetClassId : null,
        targetTeacherCode: mode === 'teacher' ? targetTeacherCode.trim().toUpperCase() : null,
        reason: reason.trim() || null,
      })

      if (result.immediate) {
        const workspace = await loadTeacherWorkspace()
        hydrateWorkspace(workspace)
        setMessage('Criança movida para a nova turma com sucesso.')
        return
      }

      setMessage('Solicitação enviada. A professora de destino ou o admin irá revisar o pedido.')
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : 'Não foi possível registrar a transferência.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = mode === 'teacher' ? targetTeacherCode.trim().length >= 6 : Boolean(targetClassId)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">Transferir criança</span>
          <span className="text-[11px] text-muted">{student.name} - {student.childCode ?? 'código pendente'}</span>
        </div>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <p className="text-[11px] text-muted">Seu código de professora</p>
          <p className="text-[18px] font-bold text-gd mt-1">{teacherCode || 'Gerando código...'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setMode('teacher')}
            className={`rounded-app-sm border px-3 py-3 text-xs font-bold ${mode === 'teacher' ? 'bg-gm text-white border-gm' : 'bg-white text-muted border-border'}`}
          >
            Outra professora
          </button>
          <button
            onClick={() => setMode('class')}
            className={`rounded-app-sm border px-3 py-3 text-xs font-bold ${mode === 'class' ? 'bg-gm text-white border-gm' : 'bg-white text-muted border-border'}`}
          >
            Minha turma
          </button>
        </div>

        {mode === 'teacher' ? (
          <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Código da professora de destino</label>
            <input
              className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
              placeholder="Ex: PROF-MARIA-2026"
              value={targetTeacherCode}
              onChange={(event) => setTargetTeacherCode(event.target.value)}
            />
          </div>
        ) : (
          <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Mover para turma</label>
            <select
              className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
              value={targetClassId}
              onChange={(event) => setTargetClassId(event.target.value)}
            >
              {otherClasses.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        )}

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Motivo ou observação</label>
        <textarea
          className="w-full min-h-[110px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none mb-4"
          placeholder="Ex.: troca de professora, virada de ano, mudança de turma..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="rounded-app p-4 border border-gp mb-4" style={{ background: '#F0FAF4' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-gm mt-[2px] flex-shrink-0" />
            <p className="text-[12px] text-soft leading-[1.6]">
              Mudanças entre suas turmas são imediatas. Transferências para outra professora precisam de aceite ou revisão do admin.
            </p>
          </div>
        </div>

        {message && <p className="text-[12px] text-gm mb-3">{message}</p>}
        {error && <p className="text-[12px] text-[#C1440E] mb-3">{error}</p>}

        <button
          onClick={() => void transfer()}
          disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <MoveRight size={18} />
          {submitting ? 'Registrando...' : mode === 'class' ? 'Mover para turma' : 'Solicitar transferência'}
        </button>
      </div>
    </div>
  )
}
