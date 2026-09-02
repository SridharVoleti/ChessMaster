// ============================================================
// authz — AuthzService
// Authentication (register / login / tokens) + authorization
// (day-slot bookings and per-day usage-session quota).
//
// Reusable: no Next.js imports, quota via AuthzConfig, time via
// an injectable Clock, storage via an injected async `Sql` handle
// (Postgres in production, in-process SQLite in tests).
// ============================================================

import type { Sql } from './store'
import { AuthzConfig, DEFAULT_AUTHZ_CONFIG } from './config'
import {
  AuthToken,
  AuthzError,
  Booking,
  BookingWithUsage,
  Clock,
  Student,
  systemClock,
  UsageSession,
} from './types'
import { generateToken, hashPassword, hashToken, newId, verifyPassword } from './crypto'
import { addDays, dateStringFor, isValidDateString } from './dates'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface StudentRow {
  id: string
  email: string
  display_name: string
  password_hash: string
  created_at: string
}

interface BookingRow {
  id: string
  student_id: string
  slot_date: string
  created_at: string
}

interface SessionRow {
  id: string
  student_id: string
  booking_id: string
  started_at: string
  expires_at: string
  ended_at: string | null
}

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  }
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    studentId: row.student_id,
    slotDate: row.slot_date,
    createdAt: row.created_at,
  }
}

function toSession(row: SessionRow): UsageSession {
  return {
    id: row.id,
    studentId: row.student_id,
    bookingId: row.booking_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    endedAt: row.ended_at,
  }
}

export interface StudentStatus {
  student: Student
  today: string
  todaysBooking: BookingWithUsage | null
  activeSession: (UsageSession & { secondsRemaining: number }) | null
  bookings: BookingWithUsage[]
}

export class AuthzService {
  constructor(
    private readonly sql: Sql,
    private readonly config: AuthzConfig = DEFAULT_AUTHZ_CONFIG,
    private readonly clock: Clock = systemClock,
  ) {}

  private async one<Row>(text: string, params: readonly unknown[]): Promise<Row | undefined> {
    const { rows } = await this.sql.query<Row>(text, params)
    return rows[0]
  }

  // ── authentication ────────────────────────────────────────

  async registerStudent(input: {
    email: string
    displayName: string
    password: string
  }): Promise<Student> {
    const email = input.email.trim().toLowerCase()
    const displayName = input.displayName.trim()
    if (!EMAIL_RE.test(email)) {
      throw new AuthzError('VALIDATION', 'Please enter a valid email address.')
    }
    if (!displayName) {
      throw new AuthzError('VALIDATION', 'Please enter a display name.')
    }
    if (input.password.length < this.config.passwordMinLength) {
      throw new AuthzError(
        'VALIDATION',
        `Password must be at least ${this.config.passwordMinLength} characters.`,
      )
    }
    const existing = await this.one<{ id: string }>(
      'select id from chessmaster.students where email = $1',
      [email],
    )
    if (existing) {
      throw new AuthzError('EMAIL_TAKEN', 'An account with this email already exists.')
    }
    const row: StudentRow = {
      id: newId(),
      email,
      display_name: displayName,
      password_hash: hashPassword(input.password),
      created_at: this.clock.now().toISOString(),
    }
    await this.sql.query(
      `insert into chessmaster.students (id, email, display_name, password_hash, created_at)
       values ($1, $2, $3, $4, $5)`,
      [row.id, row.email, row.display_name, row.password_hash, row.created_at],
    )
    return toStudent(row)
  }

  async login(input: {
    email: string
    password: string
  }): Promise<{ student: Student; auth: AuthToken }> {
    const email = input.email.trim().toLowerCase()
    const row = await this.one<StudentRow>(
      'select * from chessmaster.students where email = $1',
      [email],
    )
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      throw new AuthzError('INVALID_CREDENTIALS', 'Email or password is incorrect.')
    }
    return { student: toStudent(row), auth: await this.issueToken(row.id) }
  }

  /**
   * Mint a bearer token for a student and persist only its hash. Shared by login() and the
   * BabySteps app-launch handoff (lib/app-launch). `expiresAt` defaults to
   * now + authTokenTtlHours; a caller may pass a sooner ISO timestamp to bound the token to
   * an externally-owned session window.
   */
  async issueToken(studentId: string, expiresAt?: string): Promise<AuthToken> {
    const now = this.clock.now()
    const ttlExpiry = new Date(
      now.getTime() + this.config.authTokenTtlHours * 3_600_000,
    ).toISOString()
    const effectiveExpiry = expiresAt && expiresAt < ttlExpiry ? expiresAt : ttlExpiry
    const token = generateToken()
    await this.sql.query(
      `insert into chessmaster.auth_tokens (token_hash, student_id, issued_at, expires_at)
       values ($1, $2, $3, $4)`,
      [hashToken(token), studentId, now.toISOString(), effectiveExpiry],
    )
    return { token, expiresAt: effectiveExpiry }
  }

  async logout(token: string): Promise<void> {
    await this.sql.query('delete from chessmaster.auth_tokens where token_hash = $1', [
      hashToken(token),
    ])
  }

  /** Resolve a bearer token to its student; null if unknown or expired. */
  async getStudentByToken(token: string): Promise<Student | null> {
    const row = await this.one<StudentRow>(
      `select s.* from chessmaster.auth_tokens t
       join chessmaster.students s on s.id = t.student_id
       where t.token_hash = $1 and t.expires_at > $2`,
      [hashToken(token), this.clock.now().toISOString()],
    )
    return row ? toStudent(row) : null
  }

  // ── bookings (authorization: which day may the app be used) ──

  today(): string {
    return dateStringFor(this.clock.now(), this.config.timeZone)
  }

  async bookSlot(studentId: string, slotDate: string): Promise<Booking> {
    if (!isValidDateString(slotDate)) {
      throw new AuthzError('INVALID_DATE', 'Slot date must be a valid YYYY-MM-DD date.')
    }
    const today = this.today()
    if (slotDate < today) {
      throw new AuthzError('PAST_DATE', 'You cannot book a day that has already passed.')
    }
    const latest = addDays(today, this.config.maxAdvanceBookingDays)
    if (slotDate > latest) {
      throw new AuthzError(
        'TOO_FAR_AHEAD',
        `Slots can be booked at most ${this.config.maxAdvanceBookingDays} days ahead (up to ${latest}).`,
      )
    }
    const duplicate = await this.one<{ id: string }>(
      'select id from chessmaster.bookings where student_id = $1 and slot_date = $2',
      [studentId, slotDate],
    )
    if (duplicate) {
      throw new AuthzError('DUPLICATE_BOOKING', `You already have a booking on ${slotDate}.`)
    }
    const row: BookingRow = {
      id: newId(),
      student_id: studentId,
      slot_date: slotDate,
      created_at: this.clock.now().toISOString(),
    }
    await this.sql.query(
      `insert into chessmaster.bookings (id, student_id, slot_date, created_at)
       values ($1, $2, $3, $4)`,
      [row.id, row.student_id, row.slot_date, row.created_at],
    )
    return toBooking(row)
  }

  async listBookings(studentId: string): Promise<BookingWithUsage[]> {
    const { rows } = await this.sql.query<BookingRow & { sessions_used: number }>(
      `select b.id, b.student_id, b.slot_date, b.created_at,
              cast(count(us.id) as integer) as sessions_used
       from chessmaster.bookings b
       left join chessmaster.usage_sessions us on us.booking_id = b.id
       where b.student_id = $1
       group by b.id
       order by b.slot_date`,
      [studentId],
    )
    return rows.map(r => ({
      ...toBooking(r),
      sessionsUsed: Number(r.sessions_used),
      sessionsAllowed: this.config.sessionsPerDay,
    }))
  }

  async cancelBooking(studentId: string, bookingId: string): Promise<void> {
    const row = await this.one<BookingRow>(
      'select * from chessmaster.bookings where id = $1 and student_id = $2',
      [bookingId, studentId],
    )
    if (!row) {
      throw new AuthzError('BOOKING_NOT_FOUND', 'Booking not found.')
    }
    const used = await this.one<{ n: number }>(
      'select cast(count(*) as integer) as n from chessmaster.usage_sessions where booking_id = $1',
      [bookingId],
    )
    if (used && Number(used.n) > 0) {
      throw new AuthzError(
        'BOOKING_ALREADY_USED',
        'This booking already has sessions and cannot be cancelled.',
      )
    }
    await this.sql.query('delete from chessmaster.bookings where id = $1', [bookingId])
  }

  // ── usage sessions (the timed quota) ──────────────────────

  /**
   * Start (or resume) a usage session for today.
   * Requires a booking for today; enforces the per-day session quota.
   */
  async startSession(studentId: string): Promise<{ session: UsageSession; resumed: boolean }> {
    const active = await this.getActiveSession(studentId)
    if (active) return { session: active, resumed: true }

    const today = this.today()
    const booking = await this.one<BookingRow>(
      'select * from chessmaster.bookings where student_id = $1 and slot_date = $2',
      [studentId, today],
    )
    if (!booking) {
      throw new AuthzError(
        'NOT_BOOKED_TODAY',
        `You have no booking for today (${today}). Book a slot first.`,
      )
    }
    const usedRow = await this.one<{ n: number }>(
      'select cast(count(*) as integer) as n from chessmaster.usage_sessions where booking_id = $1',
      [booking.id],
    )
    const used = Number(usedRow?.n ?? 0)
    if (used >= this.config.sessionsPerDay) {
      throw new AuthzError(
        'QUOTA_EXHAUSTED',
        `You have used all ${this.config.sessionsPerDay} sessions for ${today}.`,
      )
    }
    const now = this.clock.now()
    const row: SessionRow = {
      id: newId(),
      student_id: studentId,
      booking_id: booking.id,
      started_at: now.toISOString(),
      expires_at: new Date(now.getTime() + this.config.sessionMinutes * 60_000).toISOString(),
      ended_at: null,
    }
    await this.sql.query(
      `insert into chessmaster.usage_sessions (id, student_id, booking_id, started_at, expires_at, ended_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [row.id, row.student_id, row.booking_id, row.started_at, row.expires_at, row.ended_at],
    )
    return { session: toSession(row), resumed: false }
  }

  /** The student's currently valid session, or null. This IS the app-usage authorization check. */
  async getActiveSession(studentId: string): Promise<UsageSession | null> {
    const row = await this.one<SessionRow>(
      `select * from chessmaster.usage_sessions
       where student_id = $1 and ended_at is null and expires_at > $2
       order by started_at desc limit 1`,
      [studentId, this.clock.now().toISOString()],
    )
    return row ? toSession(row) : null
  }

  /** End the active session early. The session still counts against the quota. */
  async endSession(studentId: string): Promise<UsageSession> {
    const active = await this.getActiveSession(studentId)
    if (!active) {
      throw new AuthzError('NO_ACTIVE_SESSION', 'There is no active session to end.')
    }
    const endedAt = this.clock.now().toISOString()
    await this.sql.query('update chessmaster.usage_sessions set ended_at = $1 where id = $2', [
      endedAt,
      active.id,
    ])
    return { ...active, endedAt }
  }

  // ── BabySteps app-launch handoff ──────────────────────────
  // These support lib/app-launch: a learner arriving from BabySteps (who already owns
  // entitlement) is provisioned into this same authority — a real students row, a booking for
  // today, and a usage_sessions row — so the /play session gate (getActiveSession) is
  // satisfied with no change to the gate itself.

  /**
   * Insert (or refresh the display name of) a student whose identity is asserted by
   * BabySteps. `id` is BabySteps' stable learner_id; there is no usable password.
   */
  async upsertLaunchStudent(input: { id: string; displayName: string }): Promise<Student> {
    const displayName = input.displayName.trim() || 'Learner'
    const existing = await this.one<StudentRow>(
      'select * from chessmaster.students where id = $1',
      [input.id],
    )

    if (existing) {
      if (existing.display_name !== displayName) {
        await this.sql.query(
          'update chessmaster.students set display_name = $1 where id = $2',
          [displayName, input.id],
        )
      }
      return toStudent({ ...existing, display_name: displayName })
    }

    const row: StudentRow = {
      id: input.id,
      email: `launch+${input.id}@apps.babysteps.in`,
      display_name: displayName,
      password_hash: hashPassword(generateToken()), // unusable — launch learners never log in
      created_at: this.clock.now().toISOString(),
    }
    await this.sql.query(
      `insert into chessmaster.students (id, email, display_name, password_hash, created_at)
       values ($1, $2, $3, $4, $5)`,
      [row.id, row.email, row.display_name, row.password_hash, row.created_at],
    )
    return toStudent(row)
  }

  /**
   * Idempotently ensure a booking exists for today for this student. Unlike bookSlot() this
   * bypasses the advance-date rules — the slot is *today*, dispatched by BabySteps.
   */
  async ensureBookingForToday(studentId: string): Promise<Booking> {
    const today = this.today()
    const existing = await this.one<BookingRow>(
      'select * from chessmaster.bookings where student_id = $1 and slot_date = $2',
      [studentId, today],
    )
    if (existing) return toBooking(existing)

    const row: BookingRow = {
      id: newId(),
      student_id: studentId,
      slot_date: today,
      created_at: this.clock.now().toISOString(),
    }
    await this.sql.query(
      `insert into chessmaster.bookings (id, student_id, slot_date, created_at)
       values ($1, $2, $3, $4)`,
      [row.id, row.student_id, row.slot_date, row.created_at],
    )
    return toBooking(row)
  }

  /**
   * Start (or resume) a usage session for a BabySteps-launched learner. Like startSession()
   * but: creates today's booking if missing, and does NOT enforce the per-day quota —
   * BabySteps owns entitlement, so a launch is never refused here. `sessionExpiresAt` (from
   * the exchange's centralSessionExpiresAt) bounds the window when it is sooner than the
   * configured sessionMinutes.
   */
  async startLaunchSession(
    studentId: string,
    opts: { sessionExpiresAt?: string } = {},
  ): Promise<{ session: UsageSession; resumed: boolean }> {
    const active = await this.getActiveSession(studentId)
    if (active) return { session: active, resumed: true }

    const booking = await this.ensureBookingForToday(studentId)
    const now = this.clock.now()
    const localExpiry = new Date(now.getTime() + this.config.sessionMinutes * 60_000).toISOString()
    const expiresAt =
      opts.sessionExpiresAt && opts.sessionExpiresAt < localExpiry ? opts.sessionExpiresAt : localExpiry

    const row: SessionRow = {
      id: newId(),
      student_id: studentId,
      booking_id: booking.id,
      started_at: now.toISOString(),
      expires_at: expiresAt,
      ended_at: null,
    }
    await this.sql.query(
      `insert into chessmaster.usage_sessions (id, student_id, booking_id, started_at, expires_at, ended_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [row.id, row.student_id, row.booking_id, row.started_at, row.expires_at, row.ended_at],
    )
    return { session: toSession(row), resumed: false }
  }

  /** Everything the account screen needs in one call. */
  async getStatus(student: Student): Promise<StudentStatus> {
    const today = this.today()
    const bookings = await this.listBookings(student.id)
    const todaysBooking = bookings.find(b => b.slotDate === today) ?? null
    const active = await this.getActiveSession(student.id)
    return {
      student,
      today,
      todaysBooking,
      bookings,
      activeSession: active
        ? {
            ...active,
            secondsRemaining: Math.max(
              0,
              Math.floor(
                (new Date(active.expiresAt).getTime() - this.clock.now().getTime()) / 1000,
              ),
            ),
          }
        : null,
    }
  }
}
