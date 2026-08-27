# BabySteps → ChessMaster launch integration

Implements the browser handoff from `CHESSMASTER_LAUNCH_INTEGRATION.md` /
`CHESSMASTER_MISSING_ROUTES.md`: a BabySteps parent taps "Open ChessMaster" and lands in the
game with the child already signed in, without the child's identity passing through the
browser.

## Routes (root-level, not under `app/api/`)

| Route | Method | Handler | Status |
|---|---|---|---|
| `/health` | `GET` | `app/health/route.ts` | `200 ok` — direct 2xx, no redirect (BabySteps' check does not follow redirects) |
| `/launch` | `POST` | `app/launch/route.ts` | Full — exchange → verify → start session → 303 into `/play/fork` + `chessquest_auth` cookie |
| `/return` | `GET` | `app/return/route.ts` | Minimal — ends the local session, clears the cookie, redirects to BabySteps |
| `/identity` | `GET` | `app/identity/route.ts` | `501` — reserved, no live caller yet |

## Flow (`POST /launch`)

```
form { launchCode, launchAttemptId }
  → exchangeLaunchCode()       mint EdDSA app assertion → POST BabySteps exchange endpoint
  → verifyBootstrapAssertion() HS256 verify with the shared secret; check iss / aud / app_id
  → provisionLaunchSession()   upsert students row + booking(today) + usage_sessions row
  → 303 redirect to /play/fork  + Set-Cookie: chessquest_auth
```

Every failure fails closed: the browser gets a plain error page; details go only to the log.

## Code

- `lib/app-launch/` — `config`, `app-assertion` (EdDSA), `exchange`, `bootstrap-assertion`
  (HS256 → typed `LearnerBootstrap`), `provision-launch-session`, `handle-app-launch`
  (framework-agnostic orchestrator, never throws).
- `lib/authz/service.ts` — added `issueToken`, `upsertLaunchStudent`, `ensureBookingForToday`,
  `startLaunchSession` (all additive). A launched learner becomes a normal row in the same
  `lib/authz` authority the `/play/[pattern]` gate already reads, so the gate passes with no
  change. Launched sessions skip the per-day `QUOTA_EXHAUSTED` check (BabySteps owns
  entitlement) but still write a booking + `usage_sessions` row for auditability.

## Configuration

Set the `APP_LAUNCH_*` block from `.env.local.example`. All values are provisioned by
BabySteps at onboarding — never commit real values. `/health` needs none of them.

| Var | Notes |
|---|---|
| `APP_LAUNCH_CLIENT_ID` | our `client_id` |
| `APP_LAUNCH_SIGNING_PRIVATE_KEY` | Ed25519 **private** JWK (JSON); BabySteps registers the public half |
| `APP_LAUNCH_BOOTSTRAP_SECRET` | 32+ char HS256 shared secret |
| `APP_LAUNCH_APP_ID` / `_ENVIRONMENT` / `_DEPLOYMENT_ID` | bind tokens to a release |
| `APP_LAUNCH_EXCHANGE_URL` | optional; defaults to the production endpoint |
| `APP_LAUNCH_BOOTSTRAP_ISSUER` | optional; defaults to `https://babysteps.in` |
| `APP_LAUNCH_RETURN_URL` | optional; where `/return` sends the learner |
| `APP_LAUNCH_LANDING_PATH` | optional; defaults to `/play/fork` |

## Tests / local run

- `npm test` — `__tests__/appLaunch.test.ts` (33 cases): config, assertion mint/verify,
  bootstrap verification (bad secret / iss / aud / expiry / app_id all rejected), exchange
  failure modes, the orchestrator, and an integration test against the real `AuthzService`
  (in-memory SQLite) proving the `/play` gate accepts the provisioned session.
- `node --env-file=.env.development.local scripts/simulate-app-launch.mjs` — runs the whole
  flow against a running dev server with a fake exchange endpoint.

## Gaps

- **`app-sdk.ts` not provided** — the reusable BabySteps module referenced in the spec is not
  available, so `lib/app-launch/` is a from-scratch equivalent. Reconcile if BabySteps ships
  it.
- **Exchange endpoint is production-only** — no staging URL yet. Tests inject a fake `fetch`;
  local runs use the simulator.
- **`/return` and `/identity`** are intentionally minimal — no live BabySteps caller yet.
- The same integration also exists in `BabyStepsIndia-ContainerApp` (Postgres-backed authz);
  this is the standalone-app copy that BabySteps' deployment pipeline tests against
  `chess-master-lilac.vercel.app`.
