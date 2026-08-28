// Orchestrates the whole POST /launch flow from CHESSMASTER_LAUNCH_INTEGRATION.md:
//   form body  ->  exchange launch code  ->  verify bootstrap assertion  ->  start session
// Framework-agnostic (no next/server import) so it is directly unit-testable. The route
// handler (app/launch/route.ts) turns the result into a NextResponse + auth cookie.
//
// Never throws: every failure comes back as { ok: false, ... } so the route fails closed.

import { AppLaunchError, ERROR_STATUS, ERROR_MESSAGE, type AppLaunchErrorCode } from './errors'
import { exchangeLaunchCode } from './exchange'
import { verifyBootstrapAssertion, type LearnerBootstrap } from './bootstrap-assertion'
import { provisionLaunchSession, type LaunchAuthz } from './provision-launch-session'
import type { AppLaunchConfig } from './config'

export type HandleAppLaunchResult =
  | {
      ok: true
      redirectTo: string
      token: string
      tokenExpiresAt: string
      sessionId: string
      learner: LearnerBootstrap
      resumed: boolean
    }
  | { ok: false; code: AppLaunchErrorCode; status: number; message: string }

export async function handleAppLaunch(params: {
  /** the application/x-www-form-urlencoded request body */
  rawBody: string
  cfg: AppLaunchConfig
  authz: LaunchAuthz
  fetchImpl?: typeof fetch
  now?: () => Date
}): Promise<HandleAppLaunchResult> {
  const { rawBody, cfg, authz, fetchImpl = fetch, now } = params
  try {
    const form = new URLSearchParams(typeof rawBody === 'string' ? rawBody : '')
    const launchCode = form.get('launchCode') ?? ''
    const launchAttemptId = form.get('launchAttemptId') ?? ''
    if (!launchCode || !launchAttemptId) {
      throw new AppLaunchError('BAD_LAUNCH_REQUEST', 'launchCode and launchAttemptId form fields are required.')
    }

    const exchange = await exchangeLaunchCode({ cfg, launchCode, launchAttemptId, fetchImpl, now })
    const learner = await verifyBootstrapAssertion({ cfg, token: exchange.bootstrapAssertion, now })
    const provisioned = await provisionLaunchSession({
      authz,
      learner,
      centralSessionExpiresAt: exchange.centralSessionExpiresAt,
    })

    return {
      ok: true,
      redirectTo: cfg.landingPath,
      token: provisioned.token,
      tokenExpiresAt: provisioned.tokenExpiresAt,
      sessionId: provisioned.sessionId,
      learner,
      resumed: provisioned.resumed,
    }
  } catch (e) {
    const code: AppLaunchErrorCode = e instanceof AppLaunchError ? e.code : 'PROVISION_FAILED'
    // Developer-facing detail to the server log; only the safe sentence goes to the browser.
    console.error('[app-launch] launch failed:', code, e instanceof Error ? e.message : e)
    return {
      ok: false,
      code,
      status: ERROR_STATUS[code] ?? 500,
      message: ERROR_MESSAGE[code] ?? 'ChessMaster could not open this launch.',
    }
  }
}
