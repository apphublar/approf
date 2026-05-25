import type { VisualUploadDebugStep } from './uploads'

export function loadUploadDebugSteps(key: string): VisualUploadDebugStep[] {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isDebugStep) : []
  } catch {
    return []
  }
}

export function saveUploadDebugSteps(key: string, steps: VisualUploadDebugStep[]) {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(steps))
  } catch {
    // Debug persistence must never block upload.
  }
}

export function clearUploadDebugSteps(key: string) {
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // Debug persistence must never block upload.
  }
}

export function upsertUploadDebugStep(
  current: VisualUploadDebugStep[],
  step: VisualUploadDebugStep,
) {
  const index = current.findIndex((item) => item.id === step.id)
  if (index < 0) return [...current, step]
  const next = [...current]
  next[index] = step
  return next
}

function storageKey(key: string) {
  return `approf:${key}:visible-upload-debug`
}

function isDebugStep(value: unknown): value is VisualUploadDebugStep {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<VisualUploadDebugStep>
  return typeof item.id === 'string'
    && typeof item.label === 'string'
    && (item.status === 'running' || item.status === 'ok' || item.status === 'error')
}
