/**
 * AuthzService — data-driven tests.
 * In-process SQLite (Postgres stand-in) + fake clock; quota rules parametrised
 * over configs so nothing asserts the literal "2 sessions / 45 minutes" by accident.
 *
 * @jest-environment node
 */
import { AuthzService } from '@/lib/authz/service'
import { AuthzError, Clock } from '@/lib/authz/types'
import { AuthzConfig, DEFAULT_AUTHZ_CONFIG, authzConfigFromEnv } from '@/lib/authz/config'
import { addDays, dateStringFor, isValidDateString } from '@/lib/authz/dates'
import { makeSqliteSql } from './helpers/sqliteStore'

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current)
  }
  advanceMinutes(mins: number): void {
    this.current = new Date(this.current.getTime() + mins * 60_000)
  }
  advanceHours(hours: number): void {
    this.advanceMinutes(hours * 60)
  }
  set(date: Date): void {
    this.current = date
  }
}

// Noon UTC keeps "today" stable in every time zone the CI box might use.
const T0 = new Date('2026-07-07T12:00:00Z')

const STUDENT = { email: 'kid@example.com', displayName: 'Kid', password: 'letmein-123' }

async function makeService(config: Partial<AuthzConfig> = {}) {
  const clock = new FakeClock(T0)
  const sql = makeSqliteSql()
  const service = new AuthzService(sql, { ...DEFAULT_AUTHZ_CONFIG, ...config }, clock)
  const student = await service.registerStudent(STUDENT)
  return { service, clock, student, sql }
}

async function expectAuthzError(run: () => Promise<unknown>, code: AuthzError['code']) {
  let err: unknown
  try {
    await run()
  } catch (e) {
    err = e
  }
  expect(err).toBeInstanceOf(AuthzError)
  expect((err as AuthzError | undefined)?.code).toBe(code)
}

// ── authentication ───────────────────────────────────────────

describe('authentication', () => {
  test('register + login round-trip', async () => {
    const { service } = await makeService()
    const { student, auth } = await service.login({ email: STUDENT.email, password: STUDENT.password })
    expect(student.email).toBe(STUDENT.email)
    expect((await service.getStudentByToken(auth.token))?.id).toBe(student.id)
  })

  test('email is normalised case-insensitively', async () => {
    const { service } = await makeService()
    const { student } = await service.login({ email: 'KID@Example.COM', password: STUDENT.password })
    expect(student.email).toBe('kid@example.com')
    await expectAuthzError(
      () => service.registerStudent({ ...STUDENT, email: 'Kid@EXAMPLE.com' }),
      'EMAIL_TAKEN',
    )
  })

  test.each([
    ['wrong password', { email: STUDENT.email, password: 'wrong-password' }],
    ['unknown email', { email: 'nobody@example.com', password: STUDENT.password }],
  ])('login rejects %s', async (_label, creds) => {
    const { service } = await makeService()
    await expectAuthzError(() => service.login(creds), 'INVALID_CREDENTIALS')
  })

  test.each([
    ['bad email', { email: 'not-an-email', displayName: 'X', password: 'long-enough-pw' }],
    ['blank name', { email: 'a@b.co', displayName: '   ', password: 'long-enough-pw' }],
    ['short password', { email: 'a@b.co', displayName: 'X', password: 'short' }],
  ])('registration rejects %s', async (_label, input) => {
    const { service } = await makeService()
    await expectAuthzError(() => service.registerStudent(input), 'VALIDATION')
  })

  test('password minimum length follows config', async () => {
    const { service } = await makeService({ passwordMinLength: 4 })
    await expect(
      service.registerStudent({ email: 'a@b.co', displayName: 'X', password: 'four' }),
    ).resolves.toBeDefined()
  })

  test('token expires after configured TTL', async () => {
    const ttlHours = 2
    const { service, clock } = await makeService({ authTokenTtlHours: ttlHours })
    const { auth } = await service.login({ email: STUDENT.email, password: STUDENT.password })
    clock.advanceHours(ttlHours - 0.01)
    expect(await service.getStudentByToken(auth.token)).not.toBeNull()
    clock.advanceHours(0.02)
    expect(await service.getStudentByToken(auth.token)).toBeNull()
  })

  test('logout invalidates the token immediately', async () => {
    const { service } = await makeService()
    const { auth } = await service.login({ email: STUDENT.email, password: STUDENT.password })
    await service.logout(auth.token)
    expect(await service.getStudentByToken(auth.token)).toBeNull()
  })
})

// ── bookings ─────────────────────────────────────────────────

describe('bookings', () => {
  test('booking today and future days succeeds', async () => {
    const { service, student } = await makeService()
    const today = service.today()
    expect((await service.bookSlot(student.id, today)).slotDate).toBe(today)
    expect((await service.bookSlot(student.id, addDays(today, 3))).slotDate).toBe(addDays(today, 3))
  })

  test.each([
    ['yesterday', -1, 'PAST_DATE'],
    ['one day beyond the advance window', DEFAULT_AUTHZ_CONFIG.maxAdvanceBookingDays + 1, 'TOO_FAR_AHEAD'],
  ] as const)('booking %s is rejected', async (_label, offset, code) => {
    const { service, student } = await makeService()
    await expectAuthzError(
      () => service.bookSlot(student.id, addDays(service.today(), offset)),
      code,
    )
  })

  test('advance-booking window follows config', async () => {
    const { service, student } = await makeService({ maxAdvanceBookingDays: 5 })
    await expect(service.bookSlot(student.id, addDays(service.today(), 5))).resolves.toBeDefined()
    await expectAuthzError(
      () => service.bookSlot(student.id, addDays(service.today(), 6)),
      'TOO_FAR_AHEAD',
    )
  })

  test.each(['2026-13-01', '2026-02-30', '07-07-2026', 'tomorrow', ''])(
    'malformed date %p is rejected',
    async (bad) => {
      const { service, student } = await makeService()
      await expectAuthzError(() => service.bookSlot(student.id, bad), 'INVALID_DATE')
    },
  )

  test('double-booking the same day is rejected', async () => {
    const { service, student } = await makeService()
    const day = addDays(service.today(), 1)
    await service.bookSlot(student.id, day)
    await expectAuthzError(() => service.bookSlot(student.id, day), 'DUPLICATE_BOOKING')
  })

  test('unused booking can be cancelled and the day rebooked', async () => {
    const { service, student } = await makeService()
    const day = addDays(service.today(), 2)
    const booking = await service.bookSlot(student.id, day)
    await service.cancelBooking(student.id, booking.id)
    expect(await service.listBookings(student.id)).toHaveLength(0)
    await expect(service.bookSlot(student.id, day)).resolves.toBeDefined()
  })

  test('booking with started sessions cannot be cancelled', async () => {
    const { service, student } = await makeService()
    const booking = await service.bookSlot(student.id, service.today())
    await service.startSession(student.id)
    await expectAuthzError(
      () => service.cancelBooking(student.id, booking.id),
      'BOOKING_ALREADY_USED',
    )
  })

  test("cancelling another student's booking is not possible", async () => {
    const { service, student } = await makeService()
    const other = await service.registerStudent({
      email: 'other@example.com',
      displayName: 'Other',
      password: 'password-xyz',
    })
    const booking = await service.bookSlot(student.id, service.today())
    await expectAuthzError(() => service.cancelBooking(other.id, booking.id), 'BOOKING_NOT_FOUND')
  })
})

// ── usage sessions — quota parametrised over configs ─────────

describe.each([
  { sessionsPerDay: 2, sessionMinutes: 45 }, // product default
  { sessionsPerDay: 3, sessionMinutes: 30 }, // proves nothing is hardcoded
  { sessionsPerDay: 1, sessionMinutes: 60 },
])('usage sessions ($sessionsPerDay × $sessionMinutes min)', ({ sessionsPerDay, sessionMinutes }) => {
  const cfg = { sessionsPerDay, sessionMinutes }

  test('starting without a booking for today is rejected', async () => {
    const { service, student } = await makeService(cfg)
    await expectAuthzError(() => service.startSession(student.id), 'NOT_BOOKED_TODAY')
  })

  test('a booking for tomorrow does not authorize today', async () => {
    const { service, student } = await makeService(cfg)
    await service.bookSlot(student.id, addDays(service.today(), 1))
    await expectAuthzError(() => service.startSession(student.id), 'NOT_BOOKED_TODAY')
  })

  test('session lasts exactly sessionMinutes', async () => {
    const { service, student, clock } = await makeService(cfg)
    await service.bookSlot(student.id, service.today())
    const { session } = await service.startSession(student.id)
    expect(new Date(session.expiresAt).getTime() - new Date(session.startedAt).getTime()).toBe(
      sessionMinutes * 60_000,
    )
    clock.advanceMinutes(sessionMinutes - 1)
    expect((await service.getActiveSession(student.id))?.id).toBe(session.id)
    clock.advanceMinutes(1)
    expect(await service.getActiveSession(student.id)).toBeNull()
  })

  test('start while active resumes instead of burning quota', async () => {
    const { service, student } = await makeService(cfg)
    await service.bookSlot(student.id, service.today())
    const first = await service.startSession(student.id)
    const second = await service.startSession(student.id)
    expect(second.resumed).toBe(true)
    expect(second.session.id).toBe(first.session.id)
  })

  test(`quota allows exactly ${sessionsPerDay} sessions, then rejects`, async () => {
    const { service, student, clock } = await makeService(cfg)
    await service.bookSlot(student.id, service.today())
    for (let i = 0; i < sessionsPerDay; i++) {
      const { resumed } = await service.startSession(student.id)
      expect(resumed).toBe(false)
      await service.endSession(student.id)
      clock.advanceMinutes(1)
    }
    await expectAuthzError(() => service.startSession(student.id), 'QUOTA_EXHAUSTED')
  })

  test('an expired (never ended) session still counts against quota', async () => {
    const { service, student, clock } = await makeService(cfg)
    await service.bookSlot(student.id, service.today())
    for (let i = 0; i < sessionsPerDay; i++) {
      await service.startSession(student.id)
      clock.advanceMinutes(sessionMinutes) // let it lapse, never call endSession
    }
    await expectAuthzError(() => service.startSession(student.id), 'QUOTA_EXHAUSTED')
  })

  test('quota resets on a separately booked next day', async () => {
    const { service, student, clock } = await makeService(cfg)
    const today = service.today()
    await service.bookSlot(student.id, today)
    await service.bookSlot(student.id, addDays(today, 1))
    for (let i = 0; i < sessionsPerDay; i++) {
      await service.startSession(student.id)
      await service.endSession(student.id)
      clock.advanceMinutes(1)
    }
    await expectAuthzError(() => service.startSession(student.id), 'QUOTA_EXHAUSTED')
    clock.advanceHours(24)
    expect(service.today()).toBe(addDays(today, 1))
    expect((await service.startSession(student.id)).resumed).toBe(false)
  })

  test('endSession without an active session is rejected', async () => {
    const { service, student } = await makeService(cfg)
    await expectAuthzError(() => service.endSession(student.id), 'NO_ACTIVE_SESSION')
  })

  test('getStatus reports booking usage and countdown', async () => {
    const { service, student, clock } = await makeService(cfg)
    await service.bookSlot(student.id, service.today())
    await service.startSession(student.id)
    clock.advanceMinutes(1)
    const status = await service.getStatus(student)
    expect(status.todaysBooking?.sessionsUsed).toBe(1)
    expect(status.todaysBooking?.sessionsAllowed).toBe(sessionsPerDay)
    expect(status.activeSession?.secondsRemaining).toBe((sessionMinutes - 1) * 60)
  })
})

// ── per-student isolation ────────────────────────────────────

describe('per-student isolation', () => {
  test("one student's sessions never consume another's quota", async () => {
    const { service, student, clock } = await makeService()
    const other = await service.registerStudent({
      email: 'other@example.com',
      displayName: 'Other',
      password: 'password-xyz',
    })
    const today = service.today()
    await service.bookSlot(student.id, today)
    await service.bookSlot(other.id, today)
    for (let i = 0; i < DEFAULT_AUTHZ_CONFIG.sessionsPerDay; i++) {
      await service.startSession(student.id)
      await service.endSession(student.id)
      clock.advanceMinutes(1)
    }
    await expectAuthzError(() => service.startSession(student.id), 'QUOTA_EXHAUSTED')
    expect((await service.startSession(other.id)).resumed).toBe(false)
    expect(await service.getActiveSession(student.id)).toBeNull()
    expect(await service.getActiveSession(other.id)).not.toBeNull()
  })
})

// ── helpers ──────────────────────────────────────────────────

describe('date helpers', () => {
  test.each([
    ['2026-07-07', true],
    ['2026-02-29', false], // 2026 is not a leap year
    ['2024-02-29', true],
    ['2026-1-05', false],
    ['nonsense', false],
  ])('isValidDateString(%p) → %p', (value, expected) => {
    expect(isValidDateString(value as string)).toBe(expected)
  })

  test.each([
    ['2026-07-07', 1, '2026-07-08'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-07-07', 30, '2026-08-06'],
  ])('addDays(%p, %p) → %p', (date, n, expected) => {
    expect(addDays(date as string, n as number)).toBe(expected)
  })

  test('dateStringFor respects the configured time zone', () => {
    const lateUtc = new Date('2026-07-07T22:00:00Z')
    expect(dateStringFor(lateUtc, 'UTC')).toBe('2026-07-07')
    expect(dateStringFor(lateUtc, 'Asia/Kolkata')).toBe('2026-07-08') // 03:30 next day IST
  })
})

describe('config from env', () => {
  test('reads overrides and falls back per-key', () => {
    const cfg = authzConfigFromEnv({
      AUTHZ_SESSIONS_PER_DAY: '3',
      AUTHZ_SESSION_MINUTES: 'not-a-number',
      AUTHZ_TIME_ZONE: 'Asia/Kolkata',
    })
    expect(cfg.sessionsPerDay).toBe(3)
    expect(cfg.sessionMinutes).toBe(DEFAULT_AUTHZ_CONFIG.sessionMinutes)
    expect(cfg.timeZone).toBe('Asia/Kolkata')
    expect(cfg.maxAdvanceBookingDays).toBe(DEFAULT_AUTHZ_CONFIG.maxAdvanceBookingDays)
  })
})
