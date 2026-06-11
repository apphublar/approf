export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}

/** Input de arquivo visível para o SO, mas fora da tela (evita bugs do iOS com display:none). */
export const MOBILE_FILE_INPUT_CLASS =
  'absolute left-0 top-0 h-px w-px overflow-hidden opacity-0 [clip:rect(0,0,0,0)]'
