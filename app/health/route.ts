export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /health — BabySteps checks this before letting a deployment go live and as part of
// ongoing availability checks (CHESSMASTER_LAUNCH_INTEGRATION.md / CHESSMASTER_MISSING_ROUTES.md).
//
// Must return 2xx *directly* — BabySteps' health check does not follow redirects, and it
// holds a deployment back on anything other than a clean 2xx. A plain liveness check is
// sufficient here: ChessMaster's game routes have no external worker to probe, and the authz
// SQLite file is only touched when AUTHZ_ENFORCE=1, so probing it would risk a false
// negative on a fresh serverless filesystem.
export async function GET(): Promise<Response> {
  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
