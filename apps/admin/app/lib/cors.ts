function normalizeOrigin(value: string | null | undefined) {
  if (!value) return ''
  return value.trim().replace(/\/$/, '')
}

function isTrustedProfessoraOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') return true
    if (host === 'app.approf.com.br' || host.endsWith('.approf.com.br')) return true
    if (host.endsWith('.vercel.app')) return true
    return false
  } catch {
    return false
  }
}

/** Origem permitida para o PWA da professora (CORS). */
export function resolveProfessoraCorsOrigin(request?: Request) {
  const requestOrigin = normalizeOrigin(request?.headers.get('Origin'))
  const configured = normalizeOrigin(
    process.env.NEXT_PUBLIC_PROFESSORA_APP_URL
      || process.env.NEXT_PUBLIC_PROFESSOR_APP_URL,
  )

  if (configured && requestOrigin && configured === requestOrigin) {
    return requestOrigin
  }

  if (requestOrigin && isTrustedProfessoraOrigin(requestOrigin)) {
    return requestOrigin
  }

  if (configured) return configured
  return '*'
}

export function buildProfessoraCorsHeaders(request?: Request) {
  const origin = resolveProfessoraCorsOrigin(request)
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    ...(origin !== '*' ? { Vary: 'Origin' } : {}),
  }
}
