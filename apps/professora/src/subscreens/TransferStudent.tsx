import { useState } from 'react'
import { ChevronLeft, MoveRight, ShieldCheck } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'

export default function TransferStudentSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, activeClassId, activeStudentId, teacherCode, updateStudent } = useAppStore()
  const cls = classes.find((item) => item.id === activeClassId) ?? classes[0]
  const student = cls?.students.find((item) => item.id === activeStudentId) ?? cls?.students[0]
  const otherClasses = classes.filter((item) => item.id !== cls?.id)

  const [mode, setMode] = useState<'teacher' | 'class'>('teacher')
  const [targetTeacherCode, setTargetTeacherCode] = useState('')
  const [targetClassId, setTargetClassId] = useState(otherClasses[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  if (!cls || !student) return null

  function transfer() {
    if (mode === 'class' && targetClassId) {
      updateStudent(cls.id, student.id, {
        generalNotes: [student.generalNotes, `Movimentacao solicitada para turma ${targetClassId}. ${reason}`].filter(Boolean).join('\n'),
      })
    }
    setDone(true)
  }

  const canSubmit = mode === 'teacher' ? targetTeacherCode.trim().length >= 6 : Boolean(targetClassId)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">Transferir crianca</span>
          <span className="text-[11px] text-muted">{student.name} - {student.childCode ?? 'codigo pendente'}</span>
        </div>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <p className="text-[11px] text-muted">Seu codigo de professora</p>
          <p className="text-[18px] font-bold text-gd mt-1">{teacherCode}</p>
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
            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Codigo da professora destino</label>
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

        <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Motivo ou observacao</label>
        <textarea
          className="w-full min-h-[110px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none mb-4"
          placeholder="Ex: troca de professora, virada de ano, mudanca de turma..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="rounded-app p-4 border border-gp mb-4" style={{ background: '#F0FAF4' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-gm mt-[2px] flex-shrink-0" />
            <p className="text-[12px] text-soft leading-[1.6]">
              A timeline acompanha a crianca somente apos aceite da professora destino ou aprovacao do Super Admin.
            </p>
          </div>
        </div>

        <button
          onClick={transfer}
          disabled={!canSubmit}
          className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <MoveRight size={18} />
          {done ? 'Transferencia registrada' : 'Registrar transferencia'}
        </button>
      </div>
    </div>
  )
}
