/**
 * StockfishWorker — unit tests.
 * Worker is mocked so tests run in Node without browser globals.
 */

import { StockfishWorker } from '../lib/stockfishWorker'

// ── Mock Worker ──────────────────────────────────────────────────
type MessageHandler = (e: { data: string }) => void

interface MockWorker {
  postMessage:  jest.Mock
  terminate:    jest.Mock
  onerror:      null
  onmessage:    MessageHandler | null
  _fire:        (msg: string) => void
}

function makeMockWorker(): MockWorker {
  const w: MockWorker = {
    postMessage:  jest.fn(),
    terminate:    jest.fn(),
    onerror:      null,
    onmessage:    null,
    _fire(msg: string) {
      w.onmessage?.({ data: msg })
    },
  }
  return w
}

let mockWorker: MockWorker
const OriginalWorker = global.Worker

beforeEach(() => {
  mockWorker = makeMockWorker()
  global.Worker = jest.fn(() => mockWorker) as unknown as typeof Worker
})

afterEach(() => {
  global.Worker = OriginalWorker
  jest.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────

describe('StockfishWorker.init', () => {
  it('TEST 1: sends "uci" on init and resolves after uciok + readyok', async () => {
    const sw = new StockfishWorker()

    const initPromise = sw.init()
    // Worker received "uci"
    expect(mockWorker.postMessage).toHaveBeenCalledWith('uci')

    // Simulate Stockfish responding
    mockWorker._fire('id name Stockfish')
    mockWorker._fire('uciok')
    expect(mockWorker.postMessage).toHaveBeenCalledWith('isready')

    mockWorker._fire('readyok')
    await expect(initPromise).resolves.toBeUndefined()
  })

  it('TEST 2: calling init() twice does not create a second Worker', async () => {
    const sw = new StockfishWorker()

    const p1 = sw.init()
    mockWorker._fire('uciok')
    mockWorker._fire('readyok')
    await p1

    await sw.init() // should be a no-op
    expect(global.Worker).toHaveBeenCalledTimes(1)
  })
})

describe('StockfishWorker.getBestMove', () => {
  it('TEST 3: sends position + go depth commands and resolves with the move', async () => {
    const sw  = new StockfishWorker()
    const fen = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1'

    const p1 = sw.init()
    mockWorker._fire('uciok')
    mockWorker._fire('readyok')
    await p1

    const movePromise = sw.getBestMove(fen, 8)
    expect(mockWorker.postMessage).toHaveBeenCalledWith(`position fen ${fen}`)
    expect(mockWorker.postMessage).toHaveBeenCalledWith('go depth 8')

    mockWorker._fire('info depth 8 score cp 250')
    mockWorker._fire('bestmove d3e5 ponder g4f6')
    await expect(movePromise).resolves.toBe('d3e5')
  })

  it('TEST 4: default depth is 10 when not specified', async () => {
    const sw = new StockfishWorker()

    const p1 = sw.init()
    mockWorker._fire('uciok')
    mockWorker._fire('readyok')
    await p1

    const movePromise = sw.getBestMove('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    expect(mockWorker.postMessage).toHaveBeenCalledWith('go depth 10')

    mockWorker._fire('bestmove e7e5')
    await expect(movePromise).resolves.toBe('e7e5')
  })
})

describe('StockfishWorker.dispose', () => {
  it('TEST 5: terminates the worker on dispose', async () => {
    const sw = new StockfishWorker()

    const p1 = sw.init()
    mockWorker._fire('uciok')
    mockWorker._fire('readyok')
    await p1

    sw.dispose()
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1)
  })
})
