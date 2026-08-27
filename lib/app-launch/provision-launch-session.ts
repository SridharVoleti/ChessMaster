// Step 5 (continued) of CHESSMASTER_LAUNCH_INTEGRATION.md: "start your own session for the
// child". Bridges a verified LearnerBootstrap into ChessMaster's learner/session authority
// (lib/authz) — a real students row + a booking for today + a usage_sessions row — then mints
// the bearer token the browser cookie carries. Downstream (the /play session gate) then
// works unchanged.

import { AppLaunchError } from './errors'
import type { LearnerBootstrap } from './bootstrap-assertion'
import type { AuthToken, Booking, Student, UsageSession } from '@/lib/authz/types'

/** The AuthzService surface this module needs — kept structural so tests can fake it. */
export interface LaunchAuthz {
  upsertLaunchStudent(input: { id: string; displayName: string }): Student
  ensureBookingForToday(studentId: string): Booking
  startLaunchSession(
    studentId: string,
    opts?: { sessionExpiresAt?: string },
  ): { session: UsageSession; resumed: boolean }
  issueToken(studentId: string, expiresAt?: string): AuthToken
}

export interface ProvisionResult {
  token: string
  tokenExpiresAt: string
  sessionId: string
  studentId: string
  resumed: boolean
}

export async function provisionLaunchSession(params: {
  authz: LaunchAuthz
  learner: LearnerBootstrap
  /** ISO — BabySteps-owned session ceiling (from the exchange's centralSessionExpiresAt) */
  centralSessionExpiresAt?: string
}): Promise<ProvisionResult> {
  const { authz, learner, centralSessionExpiresAt } = params
  try {
    const student = authz.upsertLaunchStudent({ id: learner.learnerId, displayName: learner.displayName })
    const { session, resumed } = authz.startLaunchSession(student.id, {
      sessionExpiresAt: centralSessionExpiresAt,
    })
    const auth = authz.issueToken(student.id, centralSessionExpiresAt)
    return {
      token: auth.token,
      tokenExpiresAt: auth.expiresAt,
      sessionId: session.id,
      studentId: student.id,
      resumed,
    }
  } catch (e) {
    if (e instanceof AppLaunchError) throw e
    throw new AppLaunchError('PROVISION_FAILED', `Could not provision a launch session: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
}
