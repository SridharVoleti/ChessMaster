import { buildNarrationSegments, buildGuidedSteps } from '../lib/narration'
import type { ScriptedGame } from '../app/play/[pattern]/GamePage'

const base: ScriptedGame = {
  pattern: 'fork',
  game_number: 1,
  title: 'Test',
  setup_fen: 'x',
  pgn: '1. e4 *',
  side: 'white',
}

describe('buildNarrationSegments', () => {
  it('leads with the story, then one segment per commentary line in ply order', () => {
    const game: ScriptedGame = {
      ...base,
      story: 'A quiet opening.',
      commentary: [
        { ply: 2, text: 'Black answers in the centre.' },
        { ply: 1, text: 'White takes space.' },
      ],
    }
    expect(buildNarrationSegments(game)).toEqual([
      'A quiet opening.',
      'White takes space.',
      'Black answers in the centre.',
    ])
  })

  it('works with commentary but no story', () => {
    const game: ScriptedGame = {
      ...base,
      commentary: [{ ply: 1, text: 'Only move.' }],
    }
    expect(buildNarrationSegments(game)).toEqual(['Only move.'])
  })

  it('works with a story but no commentary', () => {
    expect(buildNarrationSegments({ ...base, story: 'Just a story.' })).toEqual(['Just a story.'])
  })

  it('returns an empty array when there is nothing to narrate', () => {
    expect(buildNarrationSegments(base)).toEqual([])
  })

  it('drops blank / whitespace-only segments', () => {
    const game: ScriptedGame = {
      ...base,
      story: '   ',
      commentary: [
        { ply: 1, text: 'Real line.' },
        { ply: 2, text: '' },
      ],
    }
    expect(buildNarrationSegments(game)).toEqual(['Real line.'])
  })
})

describe('buildGuidedSteps', () => {
  it('story first, then one move step per commentary line, ply-ordered', () => {
    const game: ScriptedGame = {
      ...base,
      story: 'Intro.',
      commentary: [
        { ply: 2, text: 'Second move.' },
        { ply: 1, text: 'First move.' },
      ],
    }
    expect(buildGuidedSteps(game)).toEqual([
      { kind: 'story', text: 'Intro.' },
      { kind: 'move', ply: 1, text: 'First move.' },
      { kind: 'move', ply: 2, text: 'Second move.' },
    ])
  })

  it('keeps a blank-commentary ply as a move step with empty text (board still advances)', () => {
    const game: ScriptedGame = {
      ...base,
      commentary: [
        { ply: 1, text: 'Spoken.' },
        { ply: 2, text: '  ' },
        { ply: 3, text: 'Also spoken.' },
      ],
    }
    expect(buildGuidedSteps(game)).toEqual([
      { kind: 'move', ply: 1, text: 'Spoken.' },
      { kind: 'move', ply: 2, text: '' },
      { kind: 'move', ply: 3, text: 'Also spoken.' },
    ])
  })

  it('is empty when there is no story and no commentary', () => {
    expect(buildGuidedSteps(base)).toEqual([])
  })
})
