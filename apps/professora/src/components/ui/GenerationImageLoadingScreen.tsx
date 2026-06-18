import { useEffect, useState } from 'react'
import { CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react'

const IMAGE_STEPS = [
  'Organizando as referências',
  'Criando a composição visual',
  'Refinando cores e detalhes',
  'Salvando no histórico',
]

export default function GenerationImageLoadingScreen() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setActiveStep(1), 5000),
      window.setTimeout(() => setActiveStep(2), 15000),
      window.setTimeout(() => setActiveStep(3), 35000),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return (
    <div className="h-full w-full flex items-center justify-center px-[18px]">
      <div className="w-full max-w-[360px] bg-white rounded-app border border-border shadow-card p-5">
        <div className="w-14 h-14 rounded-[16px] bg-gbg border border-gp text-gm flex items-center justify-center mx-auto animate-pulse">
          <ImageIcon size={24} />
        </div>
        <h2 className="mt-4 text-center font-serif text-[22px] text-gd">Criando sua imagem...</h2>
        <p className="mt-2 text-center text-[13px] text-muted leading-[1.5]">
          Imagens de portfólio podem levar alguns minutos, principalmente quando há muitos detalhes.
        </p>

        <div className="mt-5 rounded-app-sm border border-border bg-cream p-3 space-y-2">
          {IMAGE_STEPS.map((step, index) => {
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
          Pode demorar um pouco. Não feche o aplicativo até a imagem ficar pronta.
        </p>
      </div>
    </div>
  )
}
