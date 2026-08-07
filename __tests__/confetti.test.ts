import {
  generateConfetti,
  DEFAULT_CONFETTI_CONFIG,
  type ConfettiConfig,
  type ConfettiPiece,
} from '@/lib/confetti'

/** Deterministic LCG so every run produces identical bursts. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function assertWithin(value: number, [min, max]: readonly [number, number]) {
  expect(value).toBeGreaterThanOrEqual(min)
  expect(value).toBeLessThanOrEqual(max)
}

// ── Parametrised: every piece honours its config ──────────────────
const CONFIG_CASES: Array<[string, Partial<ConfettiConfig>]> = [
  ['default config', {}],
  ['single piece, single color', { count: 1, colors: ['#111111'] }],
  ['large burst, stars only', { count: 120, shapes: ['star'] }],
  ['fixed size, no delay', { count: 25, sizeRangePx: [10, 10], startDelayRangeMs: [0, 0] }],
  ['slow narrow fall', { count: 40, fallDurationRangeMs: [5000, 6000], driftRangeVw: [-2, 2] }],
]

describe.each(CONFIG_CASES)('generateConfetti — %s', (_label, overrides) => {
  const cfg: ConfettiConfig = { ...DEFAULT_CONFETTI_CONFIG, ...overrides }
  let pieces: ConfettiPiece[]

  beforeAll(() => {
    pieces = generateConfetti(overrides, seededRandom(42))
  })

  it('produces exactly config.count pieces with unique ids', () => {
    expect(pieces).toHaveLength(cfg.count)
    expect(new Set(pieces.map(p => p.id)).size).toBe(cfg.count)
  })

  it('keeps every numeric field within its configured range', () => {
    for (const p of pieces) {
      assertWithin(p.leftPct, [0, 100])
      assertWithin(p.sizePx, cfg.sizeRangePx)
      assertWithin(p.fallDurationMs, cfg.fallDurationRangeMs)
      assertWithin(p.startDelayMs, cfg.startDelayRangeMs)
      assertWithin(p.driftVw, cfg.driftRangeVw)
      assertWithin(Math.abs(p.spinDeg), cfg.spinRangeDeg)
    }
  })

  it('only uses configured colors and shapes', () => {
    for (const p of pieces) {
      expect(cfg.colors).toContain(p.color)
      expect(cfg.shapes).toContain(p.shape)
    }
  })
})

// ── Edge cases ─────────────────────────────────────────────────────
describe.each<[string, Partial<ConfettiConfig>, number]>([
  ['zero count', { count: 0 }, 0],
  ['negative count clamps to zero', { count: -5 }, 0],
  ['fractional count floors', { count: 3.9 }, 3],
])('generateConfetti — %s', (_label, overrides, expected) => {
  it(`returns ${expected} pieces`, () => {
    expect(generateConfetti(overrides, seededRandom(1))).toHaveLength(expected)
  })
})

describe.each<[string, Partial<ConfettiConfig>]>([
  ['empty colors', { colors: [] }],
  ['empty shapes', { shapes: [] }],
])('generateConfetti — invalid config: %s', (_label, overrides) => {
  it('throws a descriptive error', () => {
    expect(() => generateConfetti(overrides)).toThrow(/non-empty/)
  })
})

// ── Determinism ────────────────────────────────────────────────────
describe('generateConfetti — determinism', () => {
  it.each([1, 42, 2026])('same seed %d ⇒ identical bursts', seed => {
    const a = generateConfetti({}, seededRandom(seed))
    const b = generateConfetti({}, seededRandom(seed))
    expect(a).toEqual(b)
  })

  it('different seeds ⇒ different bursts', () => {
    const a = generateConfetti({}, seededRandom(1))
    const b = generateConfetti({}, seededRandom(2))
    expect(a).not.toEqual(b)
  })
})
