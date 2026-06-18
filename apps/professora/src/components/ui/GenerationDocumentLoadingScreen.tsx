import { useEffect, useState } from 'react'
import { BookOpenCheck, CheckCircle2, ClipboardList, FileText, GraduationCap, Loader2, NotebookPen } from 'lucide-react'

const DOCUMENT_STEPS = [
  'Preparando informações',
  'Organizando o conteúdo',
  'Revisando o texto',
  'Finalizando documento',
]

type DocumentLoadingVariant = 'default' | 'report' | 'planning' | 'diary' | 'intervention'

export default function GenerationDocumentLoadingScreen({ variant = 'default' }: { variant?: DocumentLoadingVariant }) {
  const [activeStep, setActiveStep] = useState(0)
  const icon = getVariantIcon(variant)

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setActiveStep(1), 1300),
      window.setTimeout(() => setActiveStep(2), 2600),
      window.setTimeout(() => setActiveStep(3), 3900),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return (
    <div className="h-full w-full flex items-center justify-center px-[18px]">
      <div className="w-full max-w-[360px] bg-white rounded-app border border-border shadow-card p-5">
        <div className="w-14 h-14 rounded-[16px] bg-gbg border border-gp text-gm flex items-center justify-center mx-auto">
          {icon}
        </div>
        <h2 className="mt-4 text-center font-serif text-[22px] text-gd">Criando seu documento...</h2>
        <p className="mt-2 text-center text-[13px] text-muted leading-[1.5]">
          Estamos organizando as informações com cuidado. Isso pode levar alguns segundos.
        </p>

        <div className="mt-5 rounded-app-sm border border-border bg-cream p-3 space-y-2">
          {DOCUMENT_STEPS.map((step, index) => {
            const isDone = index < activeStep
            const isActive = index === activeStep
            return (
              <div key={step} className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  isDone || isActive ? 'border-gm bg-gbg text-gm' : 'border-border bg-white text-muted'
                }`}>
                  {isDone ? <CheckCircle2 size={13} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : <span className="w-2 h-2 rounded-full bg-current opacity-60" />}
                </span>
                <p className={`text-[12px] ${isDone || isActive ? 'text-ink font-bold' : 'text-muted'}`}>{step}</p>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-[12px] text-center text-gd leading-[1.5]">
          Não feche o aplicativo até a criação ser concluída.
        </p>
      </div>
    </div>
  )
}

function getVariantIcon(variant: DocumentLoadingVariant) {
  if (variant === 'report') return <FileText size={24} />
  if (variant === 'planning') return <ClipboardList size={24} />
  if (variant === 'diary') return <NotebookPen size={24} />
  if (variant === 'intervention') return <GraduationCap size={24} />
  return <BookOpenCheck size={24} />
}
