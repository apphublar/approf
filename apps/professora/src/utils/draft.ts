export function loadDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveDraft<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota or privaté mode errors.
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage errors.
  }
}
