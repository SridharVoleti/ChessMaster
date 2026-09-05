import { existsSync } from 'fs'
import { join } from 'path'
import { MODULES, getModulesByPattern, getModule } from '../lib/modules'

const REPO_ROOT = join(__dirname, '..')

describe('modules manifest', () => {
  it('has at least the fork module', () => {
    expect(MODULES.length).toBeGreaterThan(0)
  })

  it('every module has a real pattern, positive order, and an existing lessons_ref file', () => {
    for (const m of MODULES) {
      expect(typeof m.pattern).toBe('string')
      expect(m.pattern.length).toBeGreaterThan(0)
      expect(m.order).toBeGreaterThan(0)
      expect(existsSync(join(REPO_ROOT, m.lessons_ref))).toBe(true)
    }
  })

  it('module ids are unique', () => {
    const ids = MODULES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getModulesByPattern', () => {
  it('returns the fork module(s) in order', () => {
    const mods = getModulesByPattern('fork')
    expect(mods.length).toBeGreaterThan(0)
    expect(mods.every(m => m.pattern === 'fork')).toBe(true)
    expect(mods).toEqual([...mods].sort((a, b) => a.order - b.order))
  })

  it('returns an empty array for a pattern with no modules yet', () => {
    expect(getModulesByPattern('pin')).toEqual([])
  })
})

describe('getModule', () => {
  it('looks up a module by id', () => {
    expect(getModule('FK-B-01')?.pattern).toBe('fork')
  })

  it('returns undefined for an unknown id', () => {
    expect(getModule('NOT-A-MODULE')).toBeUndefined()
  })
})
