import { NextResponse } from 'next/server'
import { getAdminSessionFromCookies } from '@/app/lib/admin-auth'
import { loadAdminNavBadges } from '@/app/lib/admin-badges'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const badges = await loadAdminNavBadges()
  return NextResponse.json(badges)
}
