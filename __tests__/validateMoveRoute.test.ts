/**
 * /api/validate-move route — unit tests.
 * Supabase modules are mocked so no DB connection is needed.
 */

import { NextRequest }          from 'next/server'
import { POST }                 from '../app/api/validate-move/route'

// ── Mock Supabase ─────────────────────────────────────────────────
const mockFrom   = jest.fn()
const mockInsert = jest.fn().mockResolvedValue({ error: null })
const mockUpdate = jest.fn().mockResolvedValue({ error: null })
const mockEq     = jest.fn().mockResolvedValue({ error: null })

mockFrom.mockReturnValue({
  insert: mockInsert,
  update: () => ({ eq: mockEq }),
})

jest.mock('../lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
  createClient:        jest.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────
const LESSON = {
  feedback_correct: 'Yes! That is a fork!',
  feedback_hint:    'Look for a square where your knight attacks two pieces.',
  feedback_reveal:  'The answer was Nd3-e5!',
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

// ── Tests ─────────────────────────────────────────────────────────

describe('POST /api/validate-move', () => {
  beforeEach(() => jest.clearAllMocks())

  it('TEST 1: correct attempt 1 → correct:true, xpAwarded:50', async () => {
    const req = makeRequest({ playerMove: 'd3e5', bestMove: 'd3e5', attemptNumber: 1, lesson: LESSON })
    const res = await POST(req)
    const data = await res.json()

    expect(data.correct).toBe(true)
    expect(data.xpAwarded).toBe(50)
    expect(data.showAnswer).toBe(false)
    expect(data.hint).toBeNull()
  })

  it('TEST 2: wrong attempt 1 → correct:false, hint:null', async () => {
    const req = makeRequest({ playerMove: 'e2e4', bestMove: 'd3e5', attemptNumber: 1, lesson: LESSON })
    const res = await POST(req)
    const data = await res.json()

    expect(data.correct).toBe(false)
    expect(data.hint).toBeNull()
    expect(data.showAnswer).toBe(false)
    expect(data.xpAwarded).toBe(0)
  })

  it('TEST 3: wrong attempt 2 → hint is non-null string', async () => {
    const req = makeRequest({ playerMove: 'e2e4', bestMove: 'd3e5', attemptNumber: 2, lesson: LESSON })
    const res = await POST(req)
    const data = await res.json()

    expect(data.correct).toBe(false)
    expect(typeof data.hint).toBe('string')
    expect(data.hint.length).toBeGreaterThan(0)
  })

  it('TEST 4: wrong attempt 3 → showAnswer:true, xpAwarded:20', async () => {
    const req = makeRequest({ playerMove: 'e2e4', bestMove: 'd3e5', attemptNumber: 3, lesson: LESSON })
    const res = await POST(req)
    const data = await res.json()

    expect(data.correct).toBe(false)
    expect(data.showAnswer).toBe(true)
    expect(data.xpAwarded).toBe(20)
  })

  it('TEST 5: game_attempts row written when userId provided', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    const req = makeRequest({
      playerMove:    'd3e5',
      bestMove:      'd3e5',
      attemptNumber: 1,
      lesson:        LESSON,
      userId:        'user-123',
    })
    await POST(req)

    expect(mockFrom).toHaveBeenCalledWith('game_attempts')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id:       'user-123',
      move_played:   'd3e5',
      correct:       true,
      attempt_number: 1,
    }))
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  })

  it('TEST 6: student_progress updated after correct move (userId provided)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    const progress = {
      current_xp:          100,
      xp_level:            1,
      next_level_xp:       500,
      current_game_number: 1,
      current_pattern:     'fork',
      patterns_mastered:   [],
      current_streak:      3,
      last_active:         null,
    }
    const req = makeRequest({
      playerMove:    'd3e5',
      bestMove:      'd3e5',
      attemptNumber: 1,
      lesson:        LESSON,
      userId:        'user-123',
      progress,
      patternKey:    'fork',
      gameNumber:    1,
    })
    await POST(req)

    expect(mockFrom).toHaveBeenCalledWith('student_progress')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  })

  it('TEST 7: DB write is skipped when userId is null', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    const req = makeRequest({
      playerMove:    'd3e5',
      bestMove:      'd3e5',
      attemptNumber: 1,
      lesson:        LESSON,
      userId:        null,
    })
    await POST(req)

    expect(mockFrom).not.toHaveBeenCalled()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  })
})
