const ACTIVE_SUBSCREEN_KEY = 'approf:active-subscreen'
const SUBSCREENS_STACK_KEY = 'approf:subscreens-stack'

type PersistedSubscreen = {
  screen: string
  data?: unknown
}

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

export function persistSubscreensStack(subscreens: PersistedSubscreen[]) {
  try {
    sessionStorage.setItem(SUBSCREENS_STACK_KEY, JSON.stringify(subscreens))
  } catch {
    // ignore
  }
}

export function restoreSubscreensStack(): PersistedSubscreen[] {
  try {
    const raw = sessionStorage.getItem(SUBSCREENS_STACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is PersistedSubscreen => (
      Boolean(item)
      && typeof item === 'object'
      && typeof (item as PersistedSubscreen).screen === 'string'
    ))
  } catch {
    return []
  }
}

export function clearSubscreensStack() {
  try {
    sessionStorage.removeItem(SUBSCREENS_STACK_KEY)
  } catch {
    // ignore
  }
}

export function stashNavigationForFilePicker(screen: string, subscreens: PersistedSubscreen[]) {
  stashActiveSubscreen(screen)
  persistSubscreensStack(subscreens)
}
