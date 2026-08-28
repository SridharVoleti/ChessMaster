/**
 * HTTP-boundary tests for the four BabySteps launch routes
 * (app/health, app/launch, app/return, app/identity).
 *
 * The lib layer (lib/app-launch/*) is covered exhaustively in appLaunch.test.ts;
 * this file locks in what the Next.js route handlers themselves do — status codes,
 * headers, redirects, cookie effects and, above all, that every failure fails closed
 * without leaking a stack trace or an internal message to the parent's browser.
 *
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// ── mocks ───────────────────────────────────────────────────
// The route handlers are the unit under test; their collaborators are stubbed so a
// test never needs real APP_LAUNCH_* config, a network, or a SQLite file.
jest.mock('@/lib/app-launch/config', () => ({
  __esModule: true,
  appLaunchConfig: jest.fn(),
}))
jest.mock('@/lib/app-launch/handle-app-launch', () => ({
  __esModule: true,
  handleAppLaunch: jest.fn(),
}))
jest.mock('@/lib/authz/nextAdapter', () => {
  const actual = jest.requireActual('@/lib/authz/nextAdapter')
  return {
    __esModule: true,
    ...actual,
    getAuthzService: jest.fn(),
    studentFromCookies: jest.fn(),
  }
})

import { appLaunchConfig } from '@/lib/app-launch/config'
import { handleAppLaunch } from '@/lib/app-launch/handle-app-launch'
import { getAuthzService, studentFromCookies, AUTH_COOKIE } from '@/lib/authz/nextAdapter'

import { GET as healthGET } from '../app/health/route'
import { GET as identityGET } from '../app/identity/route'
import { GET as returnGET } from '../app/return/route'
import { GET as launchGET, POST as launchPOST } from '../app/launch/route'

const mockAppLaunchConfig = appLaunchConfig as jest.Mock
const mockHandleAppLaunch = handleAppLaunch as jest.Mock
const mockGetAuthzService = getAuthzService as jest.Mock
const mockStudentFromCookies = studentFromCookies as jest.Mock

const FAKE_CFG = { landingPath: '/play/fork', returnUrl: 'https://return.test' }

function postRequest(body: string): NextRequest {
  return {
    method: 'POST',
    nextUrl: new URL('https://chessmaster.test/launch'),
    text: async () => body,
  } as unknown as NextRequest
}

function getRequest(cookies: Record<string, string> = {}): NextRequest {
  return {
    method: 'GET',
    nextUrl: new URL('https://chessmaster.test/return'),
    cookies: {
      get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAppLaunchConfig.mockReturnValue(FAKE_CFG)
})

// ── GET /health ─────────────────────────────────────────────
describe('GET /health', () => {
  test('returns a direct 200 "ok" — not a redirect — with no-store', async () => {
    const res = await healthGET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/plain/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    // BabySteps' health check does not follow redirects: 3xx / Location would fail it.
    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toBe('ok')
  })
})

// ── GET /identity ───────────────────────────────────────────
describe('GET /identity', () => {
  test('returns a structured 501 (reserved, no contract yet)', async () => {
    const res = await identityGET()
    expect(res.status).toBe(501)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})

// ── GET /return ─────────────────────────────────────────────
describe('GET /return', () => {
  test('ends the local session and redirects to the configured return URL, clearing the cookie', async () => {
    const endSession = jest.fn()
    mockGetAuthzService.mockReturnValue({ endSession })
    mockStudentFromCookies.mockReturnValue({ id: 'learner-1' })
    process.env.APP_LAUNCH_RETURN_URL = 'https://babysteps.test/home'

    const res = await returnGET(getRequest({ [AUTH_COOKIE]: 'tok' }))

    expect(endSession).toHaveBeenCalledWith('learner-1')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://babysteps.test/home')
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${AUTH_COOKIE}=`)
    expect(setCookie).toMatch(/max-age=0/i)

    delete process.env.APP_LAUNCH_RETURN_URL
  })

  test('no session cookie → still redirects, no authz call', async () => {
    mockStudentFromCookies.mockReturnValue(null)
    const res = await returnGET(getRequest())
    expect(mockGetAuthzService).not.toHaveBeenCalled()
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toMatch(/^https:\/\/www\.babystepsindia\.com\/?$/)
  })

  test('a throwing endSession never breaks the exit redirect', async () => {
    mockStudentFromCookies.mockReturnValue({ id: 'learner-1' })
    mockGetAuthzService.mockReturnValue({
      endSession: () => { throw new Error('no active session') },
    })
    const res = await returnGET(getRequest({ [AUTH_COOKIE]: 'tok' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toMatch(/^https:\/\/www\.babystepsindia\.com\/?$/)
  })
})

// ── /launch ─────────────────────────────────────────────────
describe('GET /launch', () => {
  test('a bare GET is not a launch → 405 safe HTML page', async () => {
    const res = await launchGET()
    expect(res.status).toBe(405)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const html = await res.text()
    expect(html).toContain('Open ChessMaster from inside BabySteps.')
  })
})

describe('POST /launch', () => {
  test('happy path → 303 into the landing path with the auth cookie set', async () => {
    mockHandleAppLaunch.mockResolvedValue({
      ok: true,
      redirectTo: '/play/fork',
      token: 'sess-tok',
      tokenExpiresAt: '2026-08-27T12:00:00Z',
      sessionId: 's-1',
      learner: { learnerId: 'learner-1' },
      resumed: false,
    })
    mockGetAuthzService.mockReturnValue({})

    const res = await launchPOST(postRequest('launchCode=c&launchAttemptId=a'))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://chessmaster.test/play/fork')
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${AUTH_COOKIE}=sess-tok`)
    expect(setCookie).toMatch(/httponly/i)
  })

  test('misconfigured server (appLaunchConfig throws) → 500 safe page, no exchange attempted, no leak', async () => {
    mockAppLaunchConfig.mockImplementation(() => { throw new Error('APP_LAUNCH_BOOTSTRAP_SECRET is required to process an app launch.') })

    const res = await launchPOST(postRequest('launchCode=c&launchAttemptId=a'))

    expect(res.status).toBe(500)
    expect(mockHandleAppLaunch).not.toHaveBeenCalled()
    const html = await res.text()
    expect(html).toContain('not configured to accept launches yet')
    expect(html).not.toContain('APP_LAUNCH_BOOTSTRAP_SECRET')
  })

  test.each([
    ['BAD_LAUNCH_REQUEST', 400, 'This launch link is missing information and cannot be opened.'],
    ['EXCHANGE_FAILED', 502, 'ChessMaster could not confirm this launch with BabySteps. Please try again.'],
    ['BOOTSTRAP_INVALID', 502, 'ChessMaster could not verify who is launching. Please try again.'],
    ['PROVISION_FAILED', 500, 'ChessMaster could not start a session. Please try again.'],
  ])('handleAppLaunch failure %s → %d safe HTML page, no cookie', async (code, status, message) => {
    mockHandleAppLaunch.mockResolvedValue({ ok: false, code, status, message })
    mockGetAuthzService.mockReturnValue({})

    const res = await launchPOST(postRequest('launchCode=c&launchAttemptId=a'))

    expect(res.status).toBe(status)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(res.headers.get('set-cookie')).toBeNull()
    const html = await res.text()
    expect(html).toContain(message)
  })

  test('a message with HTML metacharacters is escaped into the error page', async () => {
    mockHandleAppLaunch.mockResolvedValue({
      ok: false, code: 'BAD_LAUNCH_REQUEST', status: 400,
      message: '<script>alert(1)</script>',
    })
    mockGetAuthzService.mockReturnValue({})

    const res = await launchPOST(postRequest('launchCode=c'))
    const html = await res.text()
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
