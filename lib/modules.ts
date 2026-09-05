// ── Modules manifest ──────────────────────────────────────────────
// content/curriculum/modules.json is the single source of truth for the
// roadmap: an ordered list of modules grouped into "worlds", each module
// holding several game-based lessons (see lib/modules-server.ts for
// loading the lesson/game payload off disk).
//
// Pure metadata only — no filesystem access — so this is safe to import
// from client components (the roadmap) the same way lib/curriculum.ts is.

import modulesJson from '@/content/curriculum/modules.json'

export type ModuleStatus = 'published' | 'planned'

export interface ModuleWorld {
  id:    string
  title: string
  order: number
}

export interface ModuleDef {
  id:           string
  /** global position on the roadmap trail (1..N) */
  order:        number
  world:        string
  pattern:      string
  title:        string
  subtitle?:    string
  icon:         string
  is_free:      boolean
  status:       ModuleStatus
  /** repo-relative path to the lesson file — absent for planned modules */
  lessons_ref?: string
}

export interface ModulesManifest {
  schema_version: string
  title:          string
  worlds:         ModuleWorld[]
  modules:        ModuleDef[]
}

export const MODULES_MANIFEST = modulesJson as unknown as ModulesManifest

/** Worlds in declared order. */
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
