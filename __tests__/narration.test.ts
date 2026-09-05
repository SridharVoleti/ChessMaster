import { buildNarrationSegments } from '../lib/narration'
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
