import { redirect } from 'next/navigation'

export function redirectWithToast(path: string, message: string) {
  const url = new URL(path, 'http://local')
  url.searchParams.set('toast', message)
  redirect(`${url.pathname}${url.search}`)
}
