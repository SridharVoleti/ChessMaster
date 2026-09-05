// ── Modules manifest ──────────────────────────────────────────────
// content/curriculum/modules.json subdivides a pattern into modules —
// e.g. "fork" can grow multiple modules (FK-B-01, FK-B-02, ...) over the
// life of the program, each holding several game-based lessons (see
// lib/modules-server.ts for loading the lesson/game payload off disk).
//
// Pure metadata only — no filesystem access — so this is safe to import
// from client components (the roadmap) the same way lib/curriculum.ts is.

import modulesJson from '@/content/curriculum/modules.json'

export interface ModuleDef {
  id:          string
  pattern:     string
  order:       number
  title:       string
  lessons_ref: string
}

export interface ModulesManifest {
  schema_version: string
  modules:        ModuleDef[]
}

export const MODULES_MANIFEST = modulesJson as unknown as ModulesManifest

/** Modules in fixed order (as authored — ascending `order` per pattern). */
export const MODULES: ModuleDef[] = MODULES_MANIFEST.modules

const modulesByPattern = new Map<string, ModuleDef[]>()
for (const m of MODULES) {
  const bucket = modulesByPattern.get(m.pattern)
  if (bucket) bucket.push(m)
  else modulesByPattern.set(m.pattern, [m])
}
for (const bucket of modulesByPattern.values()) {
  bucket.sort((a, b) => a.order - b.order)
}

const modulesById = new Map(MODULES.map(m => [m.id, m]))

/** Modules belonging to a pattern, in order. Empty array if none exist yet. */
export function getModulesByPattern(pattern: string): ModuleDef[] {
  return modulesByPattern.get(pattern) ?? []
}

/** Look up a module by its id. */
export function getModule(id: string): ModuleDef | undefined {
  return modulesById.get(id)
}
