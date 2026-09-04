/**
 * BabySteps → ChessMaster launch handoff (lib/app-launch + the /launch flow).
 * Simulates the BabySteps side, which ChessMaster has no signing analog to — only this
 * harness ever holds the keys.
 *
 * @jest-environment node
 */
import { generateKeyPairSync } from 'crypto'
import { SignJWT, importJWK, decodeJwt, jwtVerify, type JWK } from 'jose'

import { appLaunchConfig, isAppLaunchConfigured } from '@/lib/app-launch/config'
import { AppLaunchError } from '@/lib/app-launch/errors'
import { mintAppAssertion, APP_ASSERTION_AUDIENCE } from '@/lib/app-launch/app-assertion'
import { exchangeLaunchCode } from '@/lib/app-launch/exchange'
import { verifyBootstrapAssertion } from '@/lib/app-launch/bootstrap-assertion'
import { handleAppLaunch } from '@/lib/app-launch/handle-app-launch'
import type { LaunchAuthz } from '@/lib/app-launch/provision-launch-session'

import { AuthzService } from '@/lib/authz/service'
import { DEFAULT_AUTHZ_CONFIG } from '@/lib/authz/config'
import type { Clock } from '@/lib/authz/types'
import { makeSqliteSql } from './helpers/sqliteStore'

// ── fixtures ────────────────────────────────────────────────
const CLIENT_ID = 'chessmaster-client'
const APP_ID = 'chessmaster'
const APP_KEY = 'chess-masters'
const BOOTSTRAP_SECRET = 'test-bootstrap-secret-abcdefghijklmnop'
const BOOTSTRAP_ISSUER = 'https://babysteps.in'
const EXCHANGE_URL = 'https://exchange.test/v1/internal/app-launch/exchange'

function makeEnv(overrides: Record<string, string | undefined> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const env: Record<string, string | undefined> = {
    APP_LAUNCH_CLIENT_ID: CLIENT_ID,
    APP_LAUNCH_SIGNING_PRIVATE_KEY: JSON.stringify(privateKey.export({ format: 'jwk' })),
    APP_LAUNCH_BOOTSTRAP_SECRET: BOOTSTRAP_SECRET,
    APP_LAUNCH_APP_ID: APP_ID,
    APP_LAUNCH_APP_KEY: APP_KEY,
    APP_LAUNCH_ENVIRONMENT: 'test',
    APP_LAUNCH_DEPLOYMENT_ID: 'deploy-1',
    APP_LAUNCH_EXCHANGE_URL: EXCHANGE_URL,
    APP_LAUNCH_BOOTSTRAP_ISSUER: BOOTSTRAP_ISSUER,
    APP_LAUNCH_RETURN_URL: 'https://return.test',
    APP_LAUNCH_LANDING_PATH: '/play/fork',
    ...overrides,
  }
  return { env, signingPublicJwk: publicKey.export({ format: 'jwk' }) as unknown as JWK }
}
const cfgFor = (o?: Record<string, string | undefined>) => appLaunchConfig(makeEnv(o).env)

const LEARNER_CLAIMS = {
  learner_session_id: 'lsession-1',
  learner_id: 'learner-1',
  display_name: 'Ada',
  avatar_id: 'fox',
  age_years: 7,
  locale: 'en-IN',
  app_id: APP_ID,
  app_key: APP_KEY,
  deployment_id: 'deploy-1',
  release_id: 'chessmaster-dev-release-1',
}

async function signBootstrap(
  claims: Record<string, unknown> = LEARNER_CLAIMS,
  opts: { secret?: string; issuer?: string; audience?: string; exp?: number } = {},
) {
  const secret = new TextEncoder().encode(opts.secret ?? BOOTSTRAP_SECRET)
  const iat = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(opts.issuer ?? BOOTSTRAP_ISSUER)
    .setAudience(opts.audience ?? CLIENT_ID)
    .setIssuedAt(iat)
    .setExpirationTime(opts.exp ?? iat + 120)
    .sign(secret)
}

async function verifyAppAssertion(token: string, publicJwk: JWK) {
  const key = await importJWK(publicJwk, 'EdDSA')
  return jwtVerify(token, key, { audience: APP_ASSERTION_AUDIENCE })
}

function stubFetch(response: unknown) {
  const calls: { url: unknown; init: unknown }[] = []
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url, init })
    return typeof response === 'function' ? response(url, init) : response
  }) as unknown as typeof fetch & { calls: typeof calls }
  ;(impl as unknown as { calls: typeof calls }).calls = calls
  return impl as typeof fetch & { calls: typeof calls }
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current)
  }
}

// ── config ─────────────────────────────────────────────────
describe('appLaunchConfig', () => {
  test('a complete env fills defaults', () => {
    const { env } = makeEnv()
    delete env.APP_LAUNCH_EXCHANGE_URL
    delete env.APP_LAUNCH_LANDING_PATH
    const cfg = appLaunchConfig(env)
    expect(cfg.exchangeUrl).toBe('https://www.babystepsindia.com/v1/internal/app-launch/exchange')
    expect(cfg.landingPath).toBe('/play/fork')
  })

  test.each([
    'APP_LAUNCH_CLIENT_ID',
    'APP_LAUNCH_SIGNING_PRIVATE_KEY',
    'APP_LAUNCH_BOOTSTRAP_SECRET',
    'APP_LAUNCH_APP_ID',
    'APP_LAUNCH_ENVIRONMENT',
    'APP_LAUNCH_DEPLOYMENT_ID',
  ])('%s is required (fails closed)', (key) => {
    const { env } = makeEnv()
    delete (env as Record<string, unknown>)[key]
    expect(() => appLaunchConfig(env)).toThrow(AppLaunchError)
  })

  test('rejects a non-Ed25519 key and a short secret', () => {
    const a = makeEnv().env
    a.APP_LAUNCH_SIGNING_PRIVATE_KEY = JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'x' })
    expect(() => appLaunchConfig(a)).toThrow(AppLaunchError)
    const b = makeEnv().env
    b.APP_LAUNCH_BOOTSTRAP_SECRET = 'short'
    expect(() => appLaunchConfig(b)).toThrow(AppLaunchError)
  })

  test('isAppLaunchConfigured never throws', () => {
    const { env } = makeEnv()
    expect(isAppLaunchConfigured(env)).toBe(true)
    delete env.APP_LAUNCH_CLIENT_ID
    expect(isAppLaunchConfigured(env)).toBe(false)
  })
})

// ── app assertion ──────────────────────────────────────────
describe('mintAppAssertion', () => {
  test('BabySteps can verify it with the public key', async () => {
    const { env, signingPublicJwk } = makeEnv()
    const { payload, protectedHeader } = await verifyAppAssertion(
      await mintAppAssertion(appLaunchConfig(env)),
      signingPublicJwk,
    )
    expect(protectedHeader.alg).toBe('EdDSA')
    expect(payload.iss).toBe(CLIENT_ID)
    expect(payload.aud).toBe(APP_ASSERTION_AUDIENCE)
    expect(payload.app_id).toBe('chessmaster')
    expect(payload.deployment_id).toBe('deploy-1')
  })

  test('valid for exactly 60s, fresh jti each call', async () => {
    const cfg = cfgFor()
    const now = new Date('2026-08-27T10:00:00Z')
    const a = decodeJwt(await mintAppAssertion(cfg, { now: () => now }))
    expect(a.exp! - a.iat!).toBe(60)
    const b = decodeJwt(await mintAppAssertion(cfg))
    expect(a.jti).toBeTruthy()
    expect(a.jti).not.toBe(b.jti)
  })

  test('does not verify against a different public key', async () => {
    const token = await mintAppAssertion(cfgFor())
    await expect(verifyAppAssertion(token, makeEnv().signingPublicJwk)).rejects.toThrow()
  })
})

// ── bootstrap assertion ────────────────────────────────────
describe('verifyBootstrapAssertion', () => {
  test('a valid assertion yields the typed learner', async () => {
    const learner = await verifyBootstrapAssertion({ cfg: cfgFor(), token: await signBootstrap() })
    expect(learner).toMatchObject({
      learnerId: 'learner-1',
      learnerSessionId: 'lsession-1',
      displayName: 'Ada',
      avatarId: 'fox',
      ageYears: 7,
      releaseId: 'chessmaster-dev-release-1',
    })
  })

  test.each<[string, () => Promise<string>]>([
    ['wrong secret', () => signBootstrap(LEARNER_CLAIMS, { secret: 'another-secret-of-sufficient-length!!' })],
    ['wrong issuer', () => signBootstrap(LEARNER_CLAIMS, { issuer: 'https://evil.example' })],
    ['wrong audience', () => signBootstrap(LEARNER_CLAIMS, { audience: 'someone-else' })],
    ['expired', () => signBootstrap(LEARNER_CLAIMS, { exp: Math.floor(Date.now() / 1000) - 3600 })],
    ['app_id mismatch', () => signBootstrap({ ...LEARNER_CLAIMS, app_id: 'other-app' })],
    ['app_key mismatch', () => signBootstrap({ ...LEARNER_CLAIMS, app_key: 'not-our-client' })],
  ])('%s is rejected as BOOTSTRAP_INVALID', async (_label, make) => {
    await expect(
      verifyBootstrapAssertion({ cfg: cfgFor(), token: await make() }),
    ).rejects.toMatchObject({ code: 'BOOTSTRAP_INVALID' })
  })

  test('a garbage token is rejected without a raw throw', async () => {
    await expect(verifyBootstrapAssertion({ cfg: cfgFor(), token: 'not.a.jwt' })).rejects.toBeInstanceOf(AppLaunchError)
    await expect(verifyBootstrapAssertion({ cfg: cfgFor(), token: '' })).rejects.toBeInstanceOf(AppLaunchError)
  })

  test('app_key is not checked when APP_LAUNCH_APP_KEY is unset (app_id is the binding)', async () => {
    const cfg = cfgFor({ APP_LAUNCH_APP_KEY: undefined })
    const learner = await verifyBootstrapAssertion({
      cfg,
      token: await signBootstrap({ ...LEARNER_CLAIMS, app_key: 'anything-at-all' }),
    })
    expect(learner.learnerId).toBe('learner-1')
  })

  test('app_key IS checked (against the registry key, not client_id) when set', async () => {
    const cfg = cfgFor({ APP_LAUNCH_APP_KEY: APP_KEY })
    await expect(
      verifyBootstrapAssertion({
        cfg,
        token: await signBootstrap({ ...LEARNER_CLAIMS, app_key: CLIENT_ID }),
      }),
    ).rejects.toMatchObject({ code: 'BOOTSTRAP_INVALID' })
    const ok = await verifyBootstrapAssertion({
      cfg,
      token: await signBootstrap({ ...LEARNER_CLAIMS, app_key: APP_KEY }),
    })
    expect(ok.learnerId).toBe('learner-1')
  })
})

// ── exchange ───────────────────────────────────────────────
describe('exchangeLaunchCode', () => {
  test('sends the assertion header + idempotency key, returns the assertion', async () => {
    const { env, signingPublicJwk } = makeEnv()
    const fetchImpl = stubFetch(
      jsonResponse({ bootstrapAssertion: 'the-jwt', centralSessionExpiresAt: '2026-08-27T11:32:00Z' }),
    )
    const result = await exchangeLaunchCode({
      cfg: appLaunchConfig(env),
      launchCode: 'code-1',
      launchAttemptId: 'attempt-1',
      fetchImpl,
    })
    expect(result.bootstrapAssertion).toBe('the-jwt')
    const init = fetchImpl.calls[0].init as RequestInit & { headers: Record<string, string> }
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ launchCode: 'code-1', launchAttemptId: 'attempt-1' })
    expect(body.exchangeIdempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    const { payload } = await verifyAppAssertion(init.headers['x-babysteps-app-assertion'], signingPublicJwk)
    expect(payload.app_id).toBe('chessmaster')
  })

  test.each<[string, unknown]>([
    ['non-2xx', jsonResponse({ error: 'nope' }, 403)],
    ['non-JSON body', { ok: true, status: 200, json: async () => { throw new Error('x') }, text: async () => 'x' }],
    ['200 without bootstrapAssertion', jsonResponse({ somethingElse: true })],
  ])('%s fails closed', async (_label, response) => {
    await expect(
      exchangeLaunchCode({ cfg: cfgFor(), launchCode: 'c', launchAttemptId: 'a', fetchImpl: stubFetch(response) }),
    ).rejects.toMatchObject({ code: 'EXCHANGE_FAILED' })
  })

  test('a network error fails closed', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    await expect(
      exchangeLaunchCode({ cfg: cfgFor(), launchCode: 'c', launchAttemptId: 'a', fetchImpl }),
    ).rejects.toMatchObject({ code: 'EXCHANGE_FAILED' })
  })

  test('missing fields are rejected before any network call', async () => {
    const fetchImpl = stubFetch(jsonResponse({ bootstrapAssertion: 'x' }))
    await expect(
      exchangeLaunchCode({ cfg: cfgFor(), launchCode: '', launchAttemptId: 'a', fetchImpl }),
    ).rejects.toMatchObject({ code: 'BAD_LAUNCH_REQUEST' })
    expect(fetchImpl.calls).toHaveLength(0)
  })
})

// ── orchestrator ───────────────────────────────────────────
describe('handleAppLaunch', () => {
  const form = (f: Record<string, string>) => new URLSearchParams(f).toString()
  const happyFetch = async (claims = LEARNER_CLAIMS) =>
    stubFetch(jsonResponse({ bootstrapAssertion: await signBootstrap(claims), centralSessionExpiresAt: '2026-08-27T11:32:00Z' }))

  function fakeAuthz() {
    type FakeSession = { id: string; studentId: string; bookingId: string; startedAt: string; expiresAt: string; endedAt: null }
    const state = { students: new Map<string, unknown>(), sessions: [] as FakeSession[], tokens: [] as unknown[] }
    const authz: LaunchAuthz = {
      upsertLaunchStudent: async ({ id, displayName }) => {
        const s = { id, email: `launch+${id}@apps.babysteps.in`, displayName, createdAt: 'now' }
        state.students.set(id, s)
        return s
      },
      ensureBookingForToday: async (studentId) => ({ id: `b-${studentId}`, studentId, slotDate: 'today', createdAt: 'now' }),
      startLaunchSession: async (studentId, opts) => {
        const existing = state.sessions.find((x) => x.studentId === studentId && !x.endedAt)
        if (existing) return { session: existing, resumed: true }
        const session: FakeSession = { id: `s-${state.sessions.length + 1}`, studentId, bookingId: `b-${studentId}`, startedAt: 'now', expiresAt: opts?.sessionExpiresAt ?? 'later', endedAt: null }
        state.sessions.push(session)
        return { session, resumed: false }
      },
      issueToken: async (studentId, expiresAt) => {
        const token = `tok-${studentId}-${state.tokens.length + 1}`
        state.tokens.push({ token, studentId })
        return { token, expiresAt: expiresAt ?? 'ttl' }
      },
    }
    return { authz, state }
  }

  test('happy path: exchanges, verifies, provisions, redirects with a token', async () => {
    const { authz, state } = fakeAuthz()
    const result = await handleAppLaunch({
      rawBody: form({ launchCode: 'c', launchAttemptId: 'a' }),
      cfg: cfgFor(), authz, fetchImpl: await happyFetch(),
    })
    expect(result).toMatchObject({ ok: true, redirectTo: '/play/fork', sessionId: 's-1' })
    if (result.ok) expect(result.learner.learnerId).toBe('learner-1')
    expect(state.students.has('learner-1')).toBe(true)
    expect(state.sessions[0].expiresAt).toBe('2026-08-27T11:32:00Z')
  })

  test('missing form fields → 400, no exchange, no provisioning', async () => {
    const { authz, state } = fakeAuthz()
    const fetchImpl = stubFetch(jsonResponse({ bootstrapAssertion: 'x' }))
    const result = await handleAppLaunch({ rawBody: form({ launchCode: 'c' }), cfg: cfgFor(), authz, fetchImpl })
    expect(result).toMatchObject({ ok: false, status: 400, code: 'BAD_LAUNCH_REQUEST' })
    expect(fetchImpl.calls).toHaveLength(0)
    expect(state.students.size).toBe(0)
  })

  test('exchange failure → fail closed, no session', async () => {
    const { authz, state } = fakeAuthz()
    const result = await handleAppLaunch({
      rawBody: form({ launchCode: 'c', launchAttemptId: 'a' }),
      cfg: cfgFor(), authz, fetchImpl: stubFetch(jsonResponse({ error: 'no' }, 500)),
    })
    expect(result).toMatchObject({ ok: false, code: 'EXCHANGE_FAILED' })
    expect(state.sessions).toHaveLength(0)
  })

  test('bootstrap for a different app_id → rejected, no session', async () => {
    const { authz, state } = fakeAuthz()
    const result = await handleAppLaunch({
      rawBody: form({ launchCode: 'c', launchAttemptId: 'a' }),
      cfg: cfgFor(), authz, fetchImpl: await happyFetch({ ...LEARNER_CLAIMS, app_id: 'other-app' }),
    })
    expect(result).toMatchObject({ ok: false, code: 'BOOTSTRAP_INVALID' })
    expect(state.students.size).toBe(0)
  })

  test('never throws — a broken authz still returns { ok: false }', async () => {
    const brokenAuthz = { upsertLaunchStudent: () => { throw new Error('db down') } } as unknown as LaunchAuthz
    const result = await handleAppLaunch({
      rawBody: form({ launchCode: 'c', launchAttemptId: 'a' }),
      cfg: cfgFor(), authz: brokenAuthz, fetchImpl: await happyFetch(),
    })
    expect(result).toMatchObject({ ok: false, code: 'PROVISION_FAILED', status: 500 })
  })
})

// ── integration with the real AuthzService (in-memory SQLite) ──
describe('handleAppLaunch + real AuthzService', () => {
  test('provisions a student, booking and active usage session the /play gate accepts', async () => {
    const clock = new FakeClock(new Date('2026-08-27T09:00:00Z'))
    const authz = new AuthzService(makeSqliteSql(), DEFAULT_AUTHZ_CONFIG, clock)
    // central expiry (09:20) is sooner than the 45-min local cap (09:45), so it should win
    const fetchImpl = stubFetch(
      jsonResponse({
        bootstrapAssertion: await signBootstrap(),
        centralSessionExpiresAt: '2026-08-27T09:20:00Z',
      }),
    )

    const result = await handleAppLaunch({
      rawBody: new URLSearchParams({ launchCode: 'c', launchAttemptId: 'a' }).toString(),
      cfg: cfgFor(), authz, fetchImpl,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // the token resolves and the learner has an active session (this IS the /play gate check)
    expect((await authz.getStudentByToken(result.token))?.id).toBe('learner-1')
    const active = await authz.getActiveSession('learner-1')
    expect(active?.id).toBe(result.sessionId)
    // session window bounded to BabySteps' centralSessionExpiresAt (sooner than 45min default)
    expect(active?.expiresAt).toBe('2026-08-27T09:20:00Z')

    // a second launch resumes rather than stacking
    const again = await handleAppLaunch({
      rawBody: new URLSearchParams({ launchCode: 'c2', launchAttemptId: 'a2' }).toString(),
      cfg: cfgFor(), authz, fetchImpl: stubFetch(jsonResponse({ bootstrapAssertion: await signBootstrap() })),
    })
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.resumed).toBe(true)
  })

  test('a launched session skips the per-day quota (BabySteps owns entitlement)', async () => {
    const clock = new FakeClock(new Date('2026-08-27T09:00:00Z'))
    const authz = new AuthzService(makeSqliteSql(), { ...DEFAULT_AUTHZ_CONFIG, sessionsPerDay: 1 }, clock)

    await authz.upsertLaunchStudent({ id: 'learner-1', displayName: 'Ada' })
    await authz.startLaunchSession('learner-1')
    await authz.endSession('learner-1')
    // quota of 1 is used — a normal startSession would now throw QUOTA_EXHAUSTED
    await expect(authz.startLaunchSession('learner-1')).resolves.toBeDefined()
    expect(await authz.getActiveSession('learner-1')).not.toBeNull()
  })
})
