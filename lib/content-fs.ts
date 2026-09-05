// ── Runtime JSON content loader ──────────────────────────────────
// Reads lesson/game payloads from disk at request time instead of
// bundling them via webpack import(). A dynamic `import(`...${var}.json`)`
// makes webpack pull *every* file matching that path into the server
// bundle — fine at a dozen files, not at the thousands of lesson/game
// files a multi-year curriculum accumulates. Reading via fs means the
// bundle stays flat no matter how much content exists on disk: each
// request pays for exactly the one file it needs.
//
// content/curriculum/index.json itself stays a normal `import` (it's
// metadata, KBs even at thousands of units) — only the lesson/game
// *payloads* referenced by its lesson_ref/games_ref fields go through
// this loader.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()

// Content is immutable for the lifetime of a deploy (a new lesson means a
// new deploy, not a live edit), so a plain in-process Map is a safe,
// permanent cache — no TTL or invalidation needed. First request for a
// file pays one disk read; every request after that on this server
// process is a memory hit.
const cache = new Map<string, unknown>()

/**
 * Load a JSON content file by its repo-relative path — e.g. a curriculum
 * unit's `games_ref` or `lesson_ref`. Throws if the file is missing or
 * not valid JSON; callers that want a null-on-failure contract (like
 * `loadLessonContent`) should catch at the call site.
 */
export async function loadJson<T>(relPath: string): Promise<T> {
  const cached = cache.get(relPath)
  if (cached !== undefined) return cached as T

  const abs = path.join(REPO_ROOT, relPath)
  const raw = await readFile(abs, 'utf8')
  const data = JSON.parse(raw) as T
  cache.set(relPath, data)
  return data
}

/** Test-only: drop the in-memory cache so a rewritten fixture is re-read. */
export function __clearContentCache(): void {
  cache.clear()
}
