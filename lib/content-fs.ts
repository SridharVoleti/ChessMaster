// ── JSON content loader ────────────────────────────────────────────
// 2026-09-05 incident: this originally read every lesson/game payload via
// plain fs.readFile(path.join(REPO_ROOT, relPath)) at request time, to
// avoid a webpack dynamic import() pulling every file matching a pattern
// into the server bundle (fine at a dozen files, not at the thousands a
// multi-year curriculum accumulates). That worked in `next dev` and in a
// local `next build && next start` (both run against the full repo on
// disk) but broke in real Vercel production: Vercel's serverless bundle
// only ships the files Next's build-time file tracer (@vercel/nft) can
// find, and NFT does *static* analysis of require/import calls — it does
// NOT execute the code to observe a real fs.readFile(runtimeString) call,
// so content/**/*.json and scripts/games/**/*.json were silently excluded
// from the bundle -> ENOENT in production for a file that plainly exists
// in the repo. (Next's own `experimental.outputFileTracingIncludes`
// escape hatch, the usual fix for exactly this, turned out not to apply
// here either: Next's build classifies this app's /play/[pattern] route
// as a "static page" (it has generateStaticParams) and silently skips
// applying outputFileTracingIncludes for any route in that bucket.)
//
// Fix: for the two real content roots, use a webpack dynamic import()
// with a *fixed* directory prefix and only the trailing segment dynamic
// (`import(\`../content/${sub}\`)`) — webpack's "context module" bundling
// reliably includes every file under that prefix at build time (same
// mechanism that already made the plain `import` of
// content/curriculum/index.json work), and unlike raw fs.readFile it is
// genuinely traceable. Any other path (e.g. a test fixture written at
// runtime under a scratch directory) falls back to the original
// fs.readFile behavior, which still works fine outside Vercel's pruned
// serverless environment (tests, `next dev`).
//
// content/curriculum/index.json itself stays a normal top-level `import`
// (it's metadata, KBs even at thousands of units) — only the lesson/game
// *payloads* referenced by its lesson_ref/games_ref fields go through
// this loader.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const CONTENT_PREFIX = 'content/'
const SCRIPTS_GAMES_PREFIX = 'scripts/games/'

// Content is immutable for the lifetime of a deploy (a new lesson means a
// new deploy, not a live edit), so a plain in-process Map is a safe,
// permanent cache — no TTL or invalidation needed. First request for a
// file pays one disk read; every request after that on this server
// process is a memory hit.
const cache = new Map<string, unknown>()

async function readViaWebpackContextImport<T>(relPath: string): Promise<T> {
  let mod: { default: T }
  if (relPath.startsWith(CONTENT_PREFIX)) {
    mod = (await import(`../content/${relPath.slice(CONTENT_PREFIX.length)}`)) as { default: T }
  } else {
    mod = (await import(`../scripts/games/${relPath.slice(SCRIPTS_GAMES_PREFIX.length)}`)) as { default: T }
  }
  return mod.default
}

async function readViaFs<T>(relPath: string): Promise<T> {
  const abs = path.join(REPO_ROOT, relPath)
  const raw = await readFile(abs, 'utf8')
  return JSON.parse(raw) as T
}

/**
 * Load a JSON content file by its repo-relative path — e.g. a curriculum
 * unit's `games_ref` or `lesson_ref`. Throws if the file is missing or
 * not valid JSON; callers that want a null-on-failure contract (like
 * `loadLessonContent`) should catch at the call site.
 */
export async function loadJson<T>(relPath: string): Promise<T> {
  const cached = cache.get(relPath)
  if (cached !== undefined) return cached as T

  const isKnownContentRoot = relPath.startsWith(CONTENT_PREFIX) || relPath.startsWith(SCRIPTS_GAMES_PREFIX)
  const data = isKnownContentRoot ? await readViaWebpackContextImport<T>(relPath) : await readViaFs<T>(relPath)
  cache.set(relPath, data)
  return data
}

/** Test-only: drop the in-memory cache so a rewritten fixture is re-read. */
export function __clearContentCache(): void {
  cache.clear()
}
