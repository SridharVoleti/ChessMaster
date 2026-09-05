import { existsSync } from 'fs'
import { join } from 'path'
import {
  MODULES,
  MODULE_WORLDS,
  getModulesByPattern,
  getModulesByWorld,
  getModule,
} from '../lib/modules'

const REPO_ROOT = join(__dirname, '..')

describe('modules manifest', () => {
  it('has the fork module and at least one world', () => {
    expect(MODULES.length).toBeGreaterThan(0)
    expect(MODULE_WORLDS.length).toBeGreaterThan(0)
    expect(getModule('FK-B-01')?.pattern).toBe('fork')
  })

  it('module ids are unique', () => {
    const ids = MODULES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every published module points at a lesson file that exists on disk', () => {
    for (const m of MODULES) {
      if (m.status !== 'published') continue
      expect(typeof m.lessons_ref).toBe('string')
      expect(existsSync(join(REPO_ROOT, m.lessons_ref!))).toBe(true)
    }
  })

  it('every module belongs to a declared world', () => {
    const ids = new Set(MODULE_WORLDS.map(w => w.id))
    for (const m of MODULES) expect(ids.has(m.world)).toBe(true)
  })
})

describe('getModulesByPattern', () => {
  it('returns a pattern\'s modules in order', () => {
    const mods = getModulesByPattern('fork')
    expect(mods.length).toBeGreaterThan(0)
    expect(mods.every(m => m.pattern === 'fork')).toBe(true)
    expect(mods).toEqual([...mods].sort((a, b) => a.order - b.order))
  })

  it('returns an empty array for an unknown pattern', () => {
    expect(getModulesByPattern('not_a_real_pattern')).toEqual([])
  })
})

describe('getModulesByWorld', () => {
  it('returns every module in a world, in global order', () => {
    const beginners = getModulesByWorld('beginner')
    expect(beginners.length).toBeGreaterThan(0)
    expect(beginners.every(m => m.world === 'beginner')).toBe(true)
  })
})

describe('getModule', () => {
  it('looks up a module by id', () => {
    expect(getModule('FK-B-01')?.title).toBe('Fork Basics')
  })

  it('returns undefined for an unknown id', () => {
    expect(getModule('NOT-A-MODULE')).toBeUndefined()
  })
})
