const REFERRAL_STORAGE_KEY = 'approf:referral-code'

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ''
}

export function captureReferralCodeFromUrl() {
  if (typeof window === 'undefined') return null
  const ref = normalizeReferralCode(new URLSearchParams(window.location.search).get('ref'))
  if (!ref) return null
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref)
  } catch {
    // localStorage indisponível
  }
  return ref
}

export function getStoredReferralCode() {
  if (typeof window === 'undefined') return null
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY)) || null
  } catch {
    return null
  }
}

export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY)
  } catch {
    // localStorage indisponível
  }
}

export function buildReferralSignupUrl(teacherCode: string) {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (import.meta.env.VITE_APPROF_SITE_URL ?? 'https://app.approf.com.br')
  const url = new URL(baseUrl)
  url.searchParams.set('mode', 'signup')
  url.searchParams.set('ref', normalizeReferralCode(teacherCode))
  return url.toString()
}

export function buildReferralWhatsAppMessage(link: string) {
  return `Oi! Estou usando o Approf para organizar minha rotina pedagógica e acho que você vai gostar também. Cadastre-se pelo meu link e ganhe 7 dias extras de teste: ${link}`
}
