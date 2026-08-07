/**
 * StockfishWorker — typed browser Web Worker wrapper for Stockfish.js.
 *
 * Loads `public/stockfish.js` once per session and reuses the single
 * Worker across all getBestMove calls. Designed for injection into
 * DidacticOpponentConfig.stockfishWorker.
 */
export class StockfishWorker {
  private worker: Worker | null = null
  private ready   = false

  async init(): Promise<void> {
    if (this.worker && this.ready) return
    return new Promise((resolve, reject) => {
      this.worker = new Worker('/stockfish.js')
      this.worker.onerror = (e) => reject(new Error(`Stockfish worker error: ${e.message}`))
      this.worker.onmessage = (e: MessageEvent<string>) => {
        const msg = e.data
        if (msg === 'uciok') {
          this.worker!.postMessage('isready')
        } else if (msg === 'readyok') {
          this.ready = true
          resolve()
        }
      }
      this.worker.postMessage('uci')
    })
  }

  async getBestMove(fen: string, depth = 10): Promise<string> {
    if (!this.ready) await this.init()
    return new Promise((resolve) => {
      this.worker!.onmessage = (e: MessageEvent<string>) => {
        const msg = e.data
        if (msg.startsWith('bestmove')) {
          resolve(msg.split(' ')[1])
        }
      }
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage(`go depth ${depth}`)
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready  = false
  }
}
