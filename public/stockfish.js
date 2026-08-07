/**
 * ChessQuest — Stockfish.js development stub.
 *
 * Replace this file with the real Stockfish WASM build for production.
 * Download from: https://github.com/nmrugg/stockfish.js
 *
 * This stub handles the UCI handshake and returns a placeholder best move
 * so the browser worker machinery can be developed and tested without the
 * full 5 MB WASM binary.
 */

/* eslint-disable no-restricted-globals */
self.onmessage = function (e) {
  var cmd = e.data;
  if (cmd === 'uci') {
    postMessage('id name Stockfish-Dev-Stub');
    postMessage('id author ChessQuest');
    postMessage('uciok');
  } else if (cmd === 'isready') {
    postMessage('readyok');
  } else if (typeof cmd === 'string' && cmd.startsWith('go')) {
    // Return a deterministic placeholder move after a short delay.
    // The game page must treat this as a weak fallback only.
    setTimeout(function () {
      postMessage('bestmove e2e4');
    }, 100);
  }
  // All other commands (setoption, ucinewgame, stop) are silently accepted.
};
