const { Chess } = require('chess.js')

const tests = [
  { n:1, fen:'r3k3/8/8/8/8/8/8/4KR2 w - - 0 1', move:'f1f8', desc:'Rf8+ skewers Ke8, Ra8 behind' },
  { n:2, fen:'6q1/8/4k3/8/8/8/8/1B2K3 w - - 0 1', move:'b1a2', desc:'Ba2 skewers Ke6, Qg8 behind' },
  { n:3, fen:'4k3/8/4q3/8/8/8/8/R5K1 w - - 0 1', move:'a1e1', desc:'Re1+ skewers Ke8, Qe6 behind' },
  { n:4, fen:'6r1/8/4k3/8/8/8/8/4KB2 w - - 0 1', move:'f1c4', desc:'Bc4+ skewers Ke6, Rg8 behind' },
  { n:5, fen:'q7/1pp5/3p4/4k3/8/8/8/R5K1 w - - 0 1', move:'a1a5', desc:'Ra5+ skewers Ke5, Qa8 behind' },
]

for (const p of tests) {
  const b = new Chess(p.fen)
  try {
    const r = b.move({ from: p.move.slice(0,2), to: p.move.slice(2,4) })
    console.log('  ' + (r ? 'OK' : 'NULL') + ' #' + p.n + ': ' + p.move + ' — ' + p.desc)
  } catch(e) {
    console.log('  FAIL #' + p.n + ': ' + e.message.slice(0,80) + ' — ' + p.desc)
  }
}
