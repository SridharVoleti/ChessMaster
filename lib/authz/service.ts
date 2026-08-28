// ============================================================
// authz — AuthzService
// Authentication (register / login / tokens) + authorization
// (day-slot bookings and per-day usage-session quota).
//
// Reusable: no Next.js imports, quota via AuthzConfig, time via
// an injectable Clock, storage via an injected SQLite handle.
// ============================================================

import type { AuthzDb } from './db'
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
    private readonly db: AuthzDb,
    private readonly config: AuthzConfig = DEFAULT_AUTHZ_CONFIG,
    private readonly clock: Clock = systemClock,
  ) {}

  // ── authentication ────────────────────────────────────────

  registerStudent(input: { email: string; displayName: string; password: string }): Student {
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
    const existing = this.db
      .prepare('SELECT id FROM students WHERE email = ?')
      .get(email) as { id: string } | undefined
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
    this.db
      .prepare(
        `INSERT INTO students (id, email, display_name, password_hash, created_at)
         VALUES (@id, @email, @display_name, @password_hash, @created_at)`,
      )
      .run(row)
    return toStudent(row)
  }

  login(input: { email: string; password: string }): { student: Student; auth: AuthToken } {
    const email = input.email.trim().toLowerCase()
    const row = this.db
      .prepare('SELECT * FROM students WHERE email = ?')
      .get(email) as StudentRow | undefined
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      throw new AuthzError('INVALID_CREDENTIALS', 'Email or password is incorrect.')
    }
    return { student: toStudent(row), auth: this.issueToken(row.id) }
  }

  /**
   * Mint a bearer token for a student and persist only its hash. Shared by login() and the
   * BabySteps app-launch handoff (lib/app-launch). `expiresAt` defaults to
   * now + authTokenTtlHours; a caller may pass a sooner ISO timestamp to bound the token to
   * an externally-owned session window.
   */
  issueToken(studentId: string, expiresAt?: string): AuthToken {
    const now = this.clock.now()
    const ttlExpiry = new Date(
      now.getTime() + this.config.authTokenTtlHours * 3_600_000,
    ).toISOString()
    const effectiveExpiry = expiresAt && expiresAt < ttlExpiry ? expiresAt : ttlExpiry
    const token = generateToken()
    this.db
      .prepare(
        `INSERT INTO auth_tokens (token_hash, student_id, issued_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(hashToken(token), studentId, now.toISOString(), effectiveExpiry)
    return { token, expiresAt: effectiveExpiry }
  }

  logout(token: string): void {
    this.db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(hashToken(token))
  }

  /** Resolve a bearer token to its student; null if unknown or expired. */
  getStudentByToken(token: string): Student | null {
    const row = this.db
      .prepare(
        `SELECT s.* FROM auth_tokens t
         JOIN students s ON s.id = t.student_id
         WHERE t.token_hash = ? AND t.expires_at > ?`,
      )
      .get(hashToken(token), this.clock.now().toISOString()) as StudentRow | undefined
    return row ? toStudent(row) : null
  }

  // ── bookings (authorization: which day may the app be used) ──

  today(): string {
    return dateStringFor(this.clock.now(), this.config.timeZone)
  }

  bookSlot(studentId: string, slotDate: string): Booking {
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
    const duplicate = this.db
      .prepare('SELECT id FROM bookings WHERE student_id = ? AND slot_date = ?')
      .get(studentId, slotDate)
    if (duplicate) {
      throw new AuthzError('DUPLICATE_BOOKING', `You already have a booking on ${slotDate}.`)
    }
    const row: BookingRow = {
      id: newId(),
      student_id: studentId,
      slot_date: slotDate,
      created_at: this.clock.now().toISOString(),
    }
    this.db
      .prepare(
        `INSERT INTO bookings (id, student_id, slot_date, created_at)
         VALUES (@id, @student_id, @slot_date, @created_at)`,
      )
      .run(row)
    return toBooking(row)
  }

  listBookings(studentId: string): BookingWithUsage[] {
    const rows = this.db
      .prepare(
        `SELECT b.*, COUNT(us.id) AS sessions_used
         FROM bookings b
         LEFT JOIN usage_sessions us ON us.booking_id = b.id
         WHERE b.student_id = ?
         GROUP BY b.id
         ORDER BY b.slot_date`,
      )
      .all(studentId) as (BookingRow & { sessions_used: number })[]
    return rows.map(r => ({
      ...toBooking(r),
      sessionsUsed: r.sessions_used,
      sessionsAllowed: this.config.sessionsPerDay,
    }))
  }

  cancelBooking(studentId: string, bookingId: string): void {
    const row = this.db
      .prepare('SELECT * FROM bookings WHERE id = ? AND student_id = ?')
      .get(bookingId, studentId) as BookingRow | undefined
    if (!row) {
      throw new AuthzError('BOOKING_NOT_FOUND', 'Booking not found.')
    }
    const used = this.db
      .prepare('SELECT COUNT(*) AS n FROM usage_sessions WHERE booking_id = ?')
      .get(bookingId) as { n: number }
    if (used.n > 0) {
      throw new AuthzError(
        'BOOKING_ALREADY_USED',
        'This booking already has sessions and cannot be cancelled.',
      )
    }
    this.db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId)
  }

  // ── usage sessions (the timed quota) ──────────────────────

  /**
   * Start (or resume) a usage session for today.
   * Requires a booking for today; enforces the per-day session quota.
   */
  startSession(studentId: string): { session: UsageSession; resumed: boolean } {
    const active = this.getActiveSession(studentId)
    if (active) return { session: active, resumed: true }

    const today = this.today()
    const booking = this.db
      .prepare('SELECT * FROM bookings WHERE student_id = ? AND slot_date = ?')
      .get(studentId, today) as BookingRow | undefined
    if (!booking) {
      throw new AuthzError(
        'NOT_BOOKED_TODAY',
        `You have no booking for today (${today}). Book a slot first.`,
      )
    }
    const used = (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM usage_sessions WHERE booking_id = ?')
        .get(booking.id) as { n: number }
    ).n
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
    this.db
      .prepare(
        `INSERT INTO usage_sessions (id, student_id, booking_id, started_at, expires_at, ended_at)
         VALUES (@id, @student_id, @booking_id, @started_at, @expires_at, @ended_at)`,
      )
      .run(row)
    return { session: toSession(row), resumed: false }
  }

  /** The student's currently valid session, or null. This IS the app-usage authorization check. */
  getActiveSession(studentId: string): UsageSession | null {
    const row = this.db
      .prepare(
        `SELECT * FROM usage_sessions
         WHERE student_id = ? AND ended_at IS NULL AND expires_at > ?
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(studentId, this.clock.now().toISOString()) as SessionRow | undefined
    return row ? toSession(row) : null
  }

  /** End the active session early. The session still counts against the quota. */
  endSession(studentId: string): UsageSession {
    const active = this.getActiveSession(studentId)
    if (!active) {
      throw new AuthzError('NO_ACTIVE_SESSION', 'There is no active session to end.')
    }
    const endedAt = this.clock.now().toISOString()
    this.db.prepare('UPDATE usage_sessions SET ended_at = ? WHERE id = ?').run(endedAt, active.id)
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
  upsertLaunchStudent(input: { id: string; displayName: string }): Student {
    const displayName = input.displayName.trim() || 'Learner'
    const existing = this.db
      .prepare('SELECT * FROM students WHERE id = ?')
      .get(input.id) as StudentRow | undefined

    if (existing) {
      if (existing.display_name !== displayName) {
        this.db
          .prepare('UPDATE students SET display_name = ? WHERE id = ?')
          .run(displayName, input.id)
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
    this.db
      .prepare(
        `INSERT INTO students (id, email, display_name, password_hash, created_at)
         VALUES (@id, @email, @display_name, @password_hash, @created_at)`,
      )
      .run(row)
    return toStudent(row)
  }

  /**
   * Idempotently ensure a booking exists for today for this student. Unlike bookSlot() this
   * bypasses the advance-date rules — the slot is *today*, dispatched by BabySteps.
   */
  ensureBookingForToday(studentId: string): Booking {
    const today = this.today()
    const existing = this.db
      .prepare('SELECT * FROM bookings WHERE student_id = ? AND slot_date = ?')
      .get(studentId, today) as BookingRow | undefined
    if (existing) return toBooking(existing)

    const row: BookingRow = {
      id: newId(),
      student_id: studentId,
      slot_date: today,
      created_at: this.clock.now().toISOString(),
    }
    this.db
      .prepare(
        `INSERT INTO bookings (id, student_id, slot_date, created_at)
         VALUES (@id, @student_id, @slot_date, @created_at)`,
      )
      .run(row)
    return toBooking(row)
  }

  /**
   * Start (or resume) a usage session for a BabySteps-launched learner. Like startSession()
   * but: creates today's booking if missing, and does NOT enforce the per-day quota —
   * BabySteps owns entitlement, so a launch is never refused here. `sessionExpiresAt` (from
   * the exchange's centralSessionExpiresAt) bounds the window when it is sooner than the
   * configured sessionMinutes.
   */
  startLaunchSession(
    studentId: string,
    opts: { sessionExpiresAt?: string } = {},
  ): { session: UsageSession; resumed: boolean } {
    const active = this.getActiveSession(studentId)
    if (active) return { session: active, resumed: true }

    const booking = this.ensureBookingForToday(studentId)
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
    this.db
      .prepare(
        `INSERT INTO usage_sessions (id, student_id, booking_id, started_at, expires_at, ended_at)
         VALUES (@id, @student_id, @booking_id, @started_at, @expires_at, @ended_at)`,
      )
      .run(row)
    return { session: toSession(row), resumed: false }
  }

  /** Everything the account screen needs in one call. */
  getStatus(student: Student): StudentStatus {
    const today = this.today()
    const bookings = this.listBookings(student.id)
    const todaysBooking = bookings.find(b => b.slotDate === today) ?? null
    const active = this.getActiveSession(student.id)
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
