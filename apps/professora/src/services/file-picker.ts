interface PickFileOptions {
  accept: string
  debugKey: string
}

export function pickFileFromDevice(options: PickFileOptions): Promise<File | null> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.multiple = false
    input.setAttribute('data-approf-file-picker', options.debugKey)
    input.style.position = 'fixed'
    input.style.left = '0'
    input.style.top = '0'
    input.style.width = '1px'
    input.style.height = '1px'
    input.style.opacity = '0.01'
    input.style.zIndex = '2147483647'
    input.style.pointerEvents = 'auto'

    let settled = false
    const cleanup = () => {
      window.removeEventListener('focus', handleFocus)
      window.clearTimeout(focusTimeout)
      input.remove()
    }
    const finish = (file: File | null) => {
      if (settled) return
      settled = true
      writePickerDebug(options.debugKey, file ? 'selected' : 'cancelled', file)
      cleanup()
      resolve(file)
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      writePickerDebug(options.debugKey, 'error', null, error)
      cleanup()
      reject(error)
    }
    const handleFocus = () => {
      window.clearTimeout(focusTimeout)
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null)
      }, 1200)
    }
    const focusTimeout = window.setTimeout(() => {
      if (!settled && !input.files?.length) writePickerDebug(options.debugKey, 'waiting')
    }, 5000)

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null)
    })
    input.addEventListener('cancel', () => {
      finish(null)
    })
    input.addEventListener('error', (event) => {
      fail(event)
    })
    window.addEventListener('focus', handleFocus)

    document.body.appendChild(input)
    writePickerDebug(options.debugKey, 'opening')
    try {
      input.click()
    } catch (error) {
      fail(error)
    }
  })
}

function writePickerDebug(key: string, stage: string, file?: File | null, error?: unknown) {
  try {
    const nav = navigator
    const payload = {
      key,
      stage,
      at: new Date().toISOString(),
      userAgent: nav.userAgent,
      origin: window.location.origin,
      href: window.location.href,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      file: file ? {
        name: file.name,
        size: file.size,
        type: file.type || '(empty)',
      } : null,
      error: error instanceof Error ? error.message : error ? String(error) : null,
    }
    window.localStorage.setItem(`approf:${key}:file-picker-debug`, JSON.stringify(payload))
    console.info('[file-picker]', payload)
  } catch {
    // Diagnostics must never block file selection.
  }
}
