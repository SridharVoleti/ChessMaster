import { buildModuleRoadmap } from '../lib/moduleRoadmap'
import { MODULES, MODULE_WORLDS } from '../lib/modules'

const flat = (progress: { patterns_mastered: string[] }) =>
  buildModuleRoadmap(progress).flatMap(w => w.nodes)

describe('modules.json shape', () => {
  it('every module has a real world, a global order and a status', () => {
    const worldIds = new Set(MODULE_WORLDS.map(w => w.id))
    for (const m of MODULES) {
      expect(worldIds.has(m.world)).toBe(true)
      expect(m.order).toBeGreaterThan(0)
      expect(['published', 'planned']).toContain(m.status)
      if (m.status === 'published') expect(typeof m.lessons_ref).toBe('string')
    }
  })

  it('global order is unique and gapless 1..N', () => {
    const orders = MODULES.map(m => m.order).sort((a, b) => a - b)
    expect(orders).toEqual(Array.from({ length: orders.length }, (_, i) => i + 1))
  })
})

describe('buildModuleRoadmap', () => {
  it('groups modules into their declared worlds, in order', () => {
    const worlds = buildModuleRoadmap({ patterns_mastered: [] })
    expect(worlds.map(w => w.id)).toEqual(['beginner', 'intermediate', 'advanced', 'expert'])
    for (const w of worlds) {
      expect(w.nodes.every(n => n.world === w.id)).toBe(true)
      expect(w.nodes.map(n => n.order)).toEqual([...w.nodes.map(n => n.order)].sort((a, b) => a - b))
    }
  })

  it('a fresh student: the first playable module is active, the rest locked/coming-soon', () => {
    const nodes = flat({ patterns_mastered: [] })
    expect(nodes[0].id).toBe('FK-B-01')
    expect(nodes[0].status).toBe('active')
    expect(nodes[0].href).toBe('/play/fork?module=FK-B-01')

    // only one active node
    expect(nodes.filter(n => n.status === 'active')).toHaveLength(1)
    // planned modules are coming-soon and never get an href
    for (const n of nodes.slice(1)) {
      expect(['locked', 'coming-soon']).toContain(n.status)
      expect(n.href).toBeNull()
    }
  })

  it('mastering a pattern marks its module done and it stays playable (replay)', () => {
    const nodes = flat({ patterns_mastered: ['fork'] })
    const fork = nodes.find(n => n.id === 'FK-B-01')!
    expect(fork.status).toBe('done')
    expect(fork.href).toBe('/play/fork?module=FK-B-01')
  })

  it('a planned module always reads as coming-soon (no lesson to play or replay) and gates the trail', () => {
    // pin (module 2) is planned; even mastering skewer (module 4) cannot
    // pull it out of the coming-soon wall — the content does not exist.
    const nodes = flat({ patterns_mastered: ['fork', 'skewer'] })
    expect(nodes.find(n => n.id === 'FK-B-01')!.status).toBe('done')
    expect(nodes.find(n => n.id === 'PN-B-01')!.status).toBe('coming-soon')
    expect(nodes.find(n => n.id === 'SK-I-01')!.status).toBe('coming-soon')
    // FK-B-01 is done and everything after is coming-soon → no active node
    expect(nodes.filter(n => n.status === 'active')).toHaveLength(0)
  })

  it('free modules carry the isFree flag through', () => {
    const nodes = flat({ patterns_mastered: [] })
    expect(nodes.find(n => n.id === 'FK-B-01')!.isFree).toBe(true)
    expect(nodes.find(n => n.id === 'BR-B-01')!.isFree).toBe(false)
  })
})
