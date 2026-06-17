'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'

export function ToastHost() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const toast = searchParams.get('toast')
    if (!toast) return

    setMessage(toast)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('toast')
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(next)

    const timer = window.setTimeout(() => setMessage(null), 2600)
    return () => window.clearTimeout(timer)
  }, [searchParams, pathname, router])

  if (!message) return null

  return (
    <div className="admin-toast" role="status">
      <Check size={18} />
      <span>{message}</span>
    </div>
  )
}
