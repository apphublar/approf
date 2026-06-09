import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canAccessAdmin } from '@approf/auth'
import { ADMIN_ACCESS_COOKIE, isAdminAllowedEmail } from '@/app/lib/admin-auth'
import { createSupabaseServiceClient } from '@/app/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 })
    }

    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await authClient.auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
    }

    const service = createSupabaseServiceClient()
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle()

    const allowedByEmail = isAdminAllowedEmail(data.user.email ?? email)
    if (profileError && !allowedByEmail) {
      return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
    }
    if (!allowedByEmail && (!profile || !canAccessAdmin(profile.role))) {
      return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
    }

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_ACCESS_COOKIE, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: data.session.expires_in ?? 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      ok: true,
      fullName: profile?.full_name ?? data.user.email,
      role: allowedByEmail ? 'super_admin' : profile!.role,
    })
  } catch (error) {
    console.error('[admin/auth/login] erro interno', error)
    return NextResponse.json({ error: 'Não foi possível entrar agora.' }, { status: 500 })
  }
}
