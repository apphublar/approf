import confetti from 'canvas-confetti'

const AI_COLORS = ['#83C451', '#C2E8A0', '#FDFAF6', '#4F8341', '#1B4332']

export function celebrateAiGeneration() {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  confetti({
    particleCount: 34,
    angle: 60,
    spread: 48,
    startVelocity: 30,
    origin: { x: 0.08, y: 0.72 },
    colors: AI_COLORS,
    scalar: 0.82,
    ticks: 130,
    disableForReducedMotion: true,
  })

  confetti({
    particleCount: 34,
    angle: 120,
    spread: 48,
    startVelocity: 30,
    origin: { x: 0.92, y: 0.72 },
    colors: AI_COLORS,
    scalar: 0.82,
    ticks: 130,
    disableForReducedMotion: true,
  })

  window.setTimeout(() => {
    confetti({
      particleCount: 18,
      spread: 70,
      startVelocity: 20,
      origin: { x: 0.5, y: 0.66 },
      colors: AI_COLORS,
      scalar: 0.65,
      ticks: 110,
      disableForReducedMotion: true,
    })
  }, 160)
}
