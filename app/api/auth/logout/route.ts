import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, clearAuthCookie, getAuthzService } from '@/lib/authz/nextAdapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (token) {
    try {
      await getAuthzService().logout(token)
    } catch (e) {
      // The cookie is cleared regardless — a failed delete must not block logout.
      console.error('[auth/logout] token revocation failed:', e instanceof Error ? e.message : e)
    }
  }
  const res = NextResponse.json({ ok: true })
  clearAuthCookie(res)
  return res
}
