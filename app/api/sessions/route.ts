import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  getAuthzService,
  studentFromCookies,
  unauthenticatedResponse,
} from '@/lib/authz/nextAdapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET → the active usage session (404 NO_ACTIVE_SESSION if none). */
export async function GET(req: NextRequest) {
  try {
    const student = await studentFromCookies(req.cookies)
    if (!student) return unauthenticatedResponse()
    const session = await getAuthzService().getActiveSession(student.id)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'NO_ACTIVE_SESSION', message: 'No active session.' } },
        { status: 404 },
      )
    }
    return NextResponse.json({ session })
  } catch (e) {
    return errorResponse(e)
  }
}

/** POST → start (or resume) today's usage session. Enforces booking + quota. */
export async function POST(req: NextRequest) {
  try {
    const student = await studentFromCookies(req.cookies)
    if (!student) return unauthenticatedResponse()
    const { session, resumed } = await getAuthzService().startSession(student.id)
    return NextResponse.json({ session, resumed }, { status: resumed ? 200 : 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

/** DELETE → end the active session early (still counts against the quota). */
export async function DELETE(req: NextRequest) {
  try {
    const student = await studentFromCookies(req.cookies)
    if (!student) return unauthenticatedResponse()
    const session = await getAuthzService().endSession(student.id)
    return NextResponse.json({ session })
  } catch (e) {
    return errorResponse(e)
  }
}
