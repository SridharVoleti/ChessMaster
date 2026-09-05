// ── Modules manifest ──────────────────────────────────────────────
// content/curriculum/modules.json is the single file the roadmap (the
// candy-trail) loads. It is GENERATED from the drop folder
// content/modules/<pattern>/<id>.module.json by
// scripts/gen-modules-manifest.mjs (run automatically on predev /
// prebuild / pretest) — add a .module.json there and it appears on the
// roadmap on the next dev/build. Do not hand-edit modules.json.
//
// This module is metadata only — no lesson content, no fs — so it is
// safe to import from client components. The lesson payloads
// (stories + per-ply commentary) are read server-side only, by
// lib/modules-server.

import modulesJson from '@/content/curriculum/modules.json'

export type ModuleStatus = 'published' | 'planned'

export interface ModuleWorld {
  id:    string
  title: string
  order: number
}

export interface ModuleDef {
  id:            string
  /** global position on the roadmap trail (1..N) */
  order:         number
  world:         string
  pattern:       string
  title:         string
  subtitle?:     string
  icon:          string
  is_free:       boolean
  status:        ModuleStatus
  /** repo-relative path to the source .module.json */
  lessons_ref:   string
  /** how many lessons the source file holds (0 for a planned placeholder) */
  lesson_count:  number
}

export interface ModulesManifest {
  schema_version: string
  title:          string
  generated_by?:  string
  worlds:         ModuleWorld[]
  modules:        ModuleDef[]
}

export const MODULES_MANIFEST = modulesJson as unknown as ModulesManifest

/** Worlds in declared order (only worlds that hold a module). */
export const MODULE_WORLDS: ModuleWorld[] =
  [...MODULES_MANIFEST.worlds].sort((a, b) => a.order - b.order)

/** Every module, in global roadmap order. */
export const MODULES: ModuleDef[] =
  [...MODULES_MANIFEST.modules].sort((a, b) => a.order - b.order)

const modulesByPattern = new Map<string, ModuleDef[]>()
for (const m of MODULES) {
  const bucket = modulesByPattern.get(m.pattern)
  if (bucket) bucket.push(m)
  else modulesByPattern.set(m.pattern, [m])
}

const modulesById = new Map(MODULES.map(m => [m.id, m]))

/** Modules belonging to a pattern, in order. Empty array if none exist. */
export function getModulesByPattern(pattern: string): ModuleDef[] {
  return modulesByPattern.get(pattern) ?? []
}

/** Look up a module by its id. */
export function getModule(id: string): ModuleDef | undefined {
  return modulesById.get(id)
}

/** Modules that belong to a world, in global order. */
export function getModulesByWorld(worldId: string): ModuleDef[] {
  return MODULES.filter(m => m.world === worldId)
}
