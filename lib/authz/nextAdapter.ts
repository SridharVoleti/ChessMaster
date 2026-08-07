// ============================================================
// authz — Next.js adapter (the ONLY authz file that knows Next).
// Singleton service over a file-backed SQLite DB + cookie helpers
// + AuthzError → HTTP status mapping for route handlers.
// ============================================================

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { openAuthzDb } from './db'
import { authzConfigFromEnv } from './config'
import { AuthzService } from './service'
import { AuthzError, AuthzErrorCode, Student } from './types'

export const AUTH_COOKIE = 'chessquest_auth'

let singleton: AuthzService | null = null

export function getAuthzService(): AuthzService {
  if (!singleton) {
    const dbPath = process.env.AUTHZ_DB_PATH ?? path.join(process.cwd(), 'data', 'authz.sqlite')
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    }
    singleton = new AuthzService(openAuthzDb(dbPath), authzConfigFromEnv())
  }
  return singleton
}

/** Anything exposing .get(name) — NextRequest.cookies and next/headers cookies() both qualify. */
interface CookieReader {
  get(name: string): { value: string } | undefined
}

export function studentFromCookies(cookies: CookieReader): Student | null {
  const token = cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  return getAuthzService().getStudentByToken(token)
}

/** True when the /play session gate should be enforced (opt-in via env). */
export function authzEnforced(): boolean {
  return process.env.AUTHZ_ENFORCE === '1'
}

const STATUS_BY_CODE: Record<AuthzErrorCode, number> = {
  VALIDATION: 400,
  INVALID_DATE: 400,
  PAST_DATE: 400,
  TOO_FAR_AHEAD: 400,
  INVALID_CREDENTIALS: 401,
  NOT_AUTHENTICATED: 401,
  NOT_BOOKED_TODAY: 403,
  QUOTA_EXHAUSTED: 403,
  BOOKING_NOT_FOUND: 404,
  NO_ACTIVE_SESSION: 404,
  EMAIL_TAKEN: 409,
  DUPLICATE_BOOKING: 409,
  BOOKING_ALREADY_USED: 409,
}

/** Uniform JSON error responses: { error: { code, message } }. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AuthzError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: STATUS_BY_CODE[e.code] ?? 400 },
    )
  }
  console.error('[authz] unexpected error:', e)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
    { status: 500 },
  )
}

export function unauthenticatedResponse(): NextResponse {
  return errorResponse(new AuthzError('NOT_AUTHENTICATED', 'Please log in first.'))
}

export function setAuthCookie(res: NextResponse, token: string, expiresAt: string): void {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}
