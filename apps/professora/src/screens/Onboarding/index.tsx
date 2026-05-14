import { useState } from 'react'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useOnboardingStore, useAppStore } from '@/store'

const SHIFTS = ['Manhã', 'Tarde', 'Integral']
const AGE_GROUPS = ['Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim', 'Pré-escola']

export default function Onboarding() {
  const { step, data, setStep, setData, complete } = useOnboardingStore()
  const { setUserName, setSchoolName, addAnnotation } = useAppStore()

  const [s1School, setS1School] = useState(data.schoolName ?? '')
  const [s1Shift, setS1Shift] = useState(data.shift ?? 'Manhã')
  const [s2Class, setS2Class] = useState(data.className ?? '')
  const [s2Age, setS2Age] = useState(data.ageGroup ?? 'Jardim')
  const [s3Note, setS3Note] = useState(data.firstNote ?? '')
  const [name, setName] = useState('Prof.ª')

  function goStep2() {
    if (!s1School.trim()) return alert('Informe o nome da escola.')
    setData({ schoolName: s1School, shift: s1Shift })
    setSchoolName(s1School)
    setStep(2)
  }

  function goStep3() {
    if (!s2Class.trim()) return alert('Informe o nome da turma.')
    setData({ className: s2Class, ageGroup: s2Age })
    setStep(3)
  }

  function finish() {
    if (!s3Note.trim()) return alert('Escreva sua primeira anotação.')
    setData({ firstNote: s3Note })
    if (name.trim()) setUserName(name.trim())
    addAnnotation({
      id: `ob-${Date.now()}`,
      category: 'evolucao',
      label: 'Anotação',
      badgeClass: 'badge-ev',
      studentName: null,
      text: s3Note,
      date: 'Agora',
    })
    confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#83C451', '#C2E8A0', '#FDFAF6', '#4F8341', '#1B4332'],
    })
    setTimeout(() => complete(), 800)
  }

  return (
    <div className="absolute inset-0 chalk-bg flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 relative z-10">
        {step > 1 ? (
          <button
            onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <span className="font-chalk text-white/50 text-lg">{step} / 3</span>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-8 relative z-10">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gl rounded-full transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 relative z-10">
        {step === 1 && (
          <StepOne
            school={s1School} setSchool={setS1School}
            shift={s1Shift} setShift={setS1Shift}
            name={name} setName={setName}
            onNext={goStep2}
          />
        )}
        {step === 2 && (
          <StepTwo
            className={s2Class} setClassName={setS2Class}
            ageGroup={s2Age} setAgeGroup={setS2Age}
            onNext={goStep3}
          />
        )}
        {step === 3 && (
          <StepThree note={s3Note} setNote={setS3Note} onFinish={finish} />
        )}
      </div>
    </div>
  )
}

/* ─── Step 1 ─── */
function StepOne({
  school, setSchool, shift, setShift, name, setName, onNext,
}: {
  school: string; setSchool: (v: string) => void
  shift: string; setShift: (v: string) => void
  name: string; setName: (v: string) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-chalk text-white/60 text-xl mb-1">✏︎ Bem-vinda!</p>
        <h1 className="font-chalk text-white text-4xl font-bold leading-tight">
          Como podemos te chamar?
        </h1>
        <p className="text-white/55 text-sm mt-3 leading-relaxed">
          Vamos configurar o Approf para a sua rotina em 3 passos rápidos.
        </p>
      </div>

      <div className="bg-white rounded-app p-5 flex flex-col gap-4 shadow-xl">
        <Field label="Seu nome">
          <input
            className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
            placeholder="Ex: Prof.ª Ana Lima"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Escola que você leciona">
          <input
            className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
            placeholder="Ex: E.M. João XXIII"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
        </Field>

        <Field label="Turno">
          <div className="flex gap-2">
            {SHIFTS.map((s) => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className={`flex-1 py-2 rounded-app-sm border-[1.5px] text-sm font-semibold transition-all ${
                  shift === s
                    ? 'border-gm bg-gbg text-gm'
                    : 'border-border bg-white text-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <NextButton onClick={onNext} label="Continuar" />
    </div>
  )
}

/* ─── Step 2 ─── */
function StepTwo({
  className, setClassName, ageGroup, setAgeGroup, onNext,
}: {
  className: string; setClassName: (v: string) => void
  ageGroup: string; setAgeGroup: (v: string) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-chalk text-white/60 text-xl mb-1">✏︎ Passo 2</p>
        <h1 className="font-chalk text-white text-4xl font-bold leading-tight">
          Cadastre sua primeira turma
        </h1>
        <p className="text-white/55 text-sm mt-3 leading-relaxed">
          Você pode adicionar mais turmas depois. Comece pela principal.
        </p>
      </div>

      <div className="bg-white rounded-app p-5 flex flex-col gap-4 shadow-xl">
        <Field label="Nome da turma">
          <input
            className="w-full px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors"
            placeholder="Ex: Maternal II, Jardim A, Pré I..."
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </Field>

        <Field label="Faixa etária">
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((ag) => (
              <button
                key={ag}
                onClick={() => setAgeGroup(ag)}
                className={`px-3 py-2 rounded-full border-[1.5px] text-xs font-semibold transition-all ${
                  ageGroup === ag
                    ? 'border-gm bg-gbg text-gm'
                    : 'border-border bg-white text-muted'
                }`}
              >
                {ag}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <NextButton onClick={onNext} label="Continuar" />
    </div>
  )
}

/* ─── Step 3 ─── */
function StepThree({
  note, setNote, onFinish,
}: {
  note: string; setNote: (v: string) => void; onFinish: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-chalk text-white/60 text-xl mb-1">✏︎ Passo 3</p>
        <h1 className="font-chalk text-white text-4xl font-bold leading-tight">
          Faça sua primeira anotação
        </h1>
        <p className="text-white/55 text-sm mt-3 leading-relaxed">
          Texto livre — escreva sobre um aluno, uma aula, uma ideia. Do jeito que você pensa.
        </p>
      </div>

      <div className="bg-white rounded-app p-5 flex flex-col gap-4 shadow-xl">
        <textarea
          className="w-full min-h-[160px] px-4 py-3 rounded-app-sm border-[1.5px] border-border bg-white font-sans text-sm text-ink outline-none focus:border-gl transition-colors resize-none leading-relaxed"
          placeholder="Ex: Sofia mostrou grande evolução na leitura hoje. Conseguiu ler a frase inteira sozinha e ficou muito orgulhosa..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="bg-gbg rounded-app-sm p-3 border border-gp text-xs text-gd leading-relaxed">
          ✨ <strong>A IA vai ajudar aqui!</strong> Depois que você tiver mais anotações, acesse o perfil do aluno e clique em "Gerar relatório" — o Approf transforma tudo em documento pronto.
        </div>
      </div>

      <button
        onClick={onFinish}
        className="w-full py-4 rounded-app bg-gm text-white font-bold text-base flex items-center justify-center gap-2 shadow-fab"
      >
        <Check size={18} strokeWidth={2.5} />
        Começar a usar o Approf
      </button>
    </div>
  )
}

/* ─── Shared ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-soft mb-[5px]">{label}</label>
      {children}
    </div>
  )
}

function NextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-app bg-gm text-white font-bold text-base flex items-center justify-center gap-2 shadow-fab"
    >
      {label}
      <ChevronRight size={18} strokeWidth={2.5} />
    </button>
  )
}
