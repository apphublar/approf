const ACTIVE_SUBSCREEN_KEY = 'approf:active-subscreen'

export function stashActiveSubscreen(screen: string) {
  try {
    sessionStorage.setItem(ACTIVE_SUBSCREEN_KEY, screen)
  } catch {
    // ignore
  }
}

export function peekActiveSubscreen() {
  try {
    return sessionStorage.getItem(ACTIVE_SUBSCREEN_KEY)
  } catch {
    return null
  }
}

export function consumeActiveSubscreen() {
  const screen = peekActiveSubscreen()
  try {
    sessionStorage.removeItem(ACTIVE_SUBSCREEN_KEY)
  } catch {
    // ignore
  }
  return screen
}
