const { Chess } = require('chess.js')

// Discovered attack: moving piece A reveals an attack by piece B behind it.
// best_move = the move that uncovers the attack (the moving piece itself may or may not also attack)
const tests = [
  // Game 1: Knight moves, reveals rook attack on queen (rank)
  // White: Kg1, Rf5, Nf3. Black: Ke8, Qf7.
  // Nf3 moves off the f-file (e.g. Nf3-e5), revealing Rf5 attacks Qf7.
  { n:1, fen:'4k3/5q2/8/5R2/8/5N2/8/6K1 w - - 0 1', move:'f3e5', desc:'Nf3-e5 reveals Rf5 attacks Qf7' },

  // Game 2: Pawn moves, reveals bishop attack on king (diagonal)
  // White: Kg1, Bc4, Pe5. Black: Ke8, pawns.
  // Pe5-e6 uncovers Bc4 diagonal attack? No, pawn is not on the c4-e6 diagonal.
  // White Bc4, pawn on d5. Bd5 pawn? No, bishop is on c4.
  // White: Kg1, Ba3, Nb5. Black: Ke8, Qe7.
  // Nb5-d6+? Reveals Ba3 attacks Ke8? a3-b4-c5-d6-e7-... not hitting e8.
  //
  // Simpler: White Bg5, Pe6. Pe6 on diagonal of Bg5? g5-f6-e7, not through e6.
  // White Bd3, Nf5. Black Ke8, Qe7.
  // Bd3-f5 diagonal: d3-e4-f5. Nf5 blocks? After Bd3 moves, Nf5-e7 could reveal Bd3.
  //
  // Let me try: White Bg2, Pe4. Black Ke8, Qb7.
  // g2-f3-e4-d5-c6-b7: Bg2 diagonal hits Qb7! If Pe4 moves (e4-e5 or captures), Bg2 attacks Qb7.
  // White: Kg1, Bg2, Pe4. Black: Ke8, Qb7.
  { n:2, fen:'4k3/1q6/8/8/4P3/8/6B1/6K1 w - - 0 1', move:'e4e5', desc:'e4-e5 reveals Bg2 attacks Qb7 (diagonal)' },

  // Game 3: Bishop moves to give check, reveals rook attacks queen
  // White: Kg1, Ra7, Bd5. Black: Ke8, Qe3.
  // Bd5 moves (e.g. Bd5-e6+), reveals Ra7 attacks... not on same line.
  // White: Kg1, Rh3, Bh5. Black: Ke8, Qe2.
  // Bh5-e2? That captures, not discovers.
  // White Rg1, Bg7. Black Kf8... hmm.
  //
  // Let's try: White Re3, Bd3. Black Qd8, Ke8 (d-file).
  // Move Bd3-h7+ (check king somewhere), reveals Re3 attacks Qd8? e3-d3-..? No, rook on e3 not on d-file.
  //
  // White Rd1, Nd4. Black Kh8, Qd8 (d-file).
  // Nd4 moves off d-file (e.g. Nd4-f5), reveals Rd1 attacks Qd8.
  { n:3, fen:'3qk3/8/8/8/3N4/8/8/3RK3 w - - 0 1', move:'d4f5', desc:'Nd4-f5 reveals Rd1 attacks Qd8' },

  // Game 4: Discovered check — moving piece reveals check on king
  // White: Kg1, Rb5, Nf5. Black: Ke5, other piece.
  // Nf5-d6+ moves, reveals Rb5 gives check to Ke5? b5-e5: same rank! Rb5 attacks e5.
  // After Nf5 moves (freeing the b5-e5 rank view? Nf5 is on f5, not between b5 and e5.
  //
  // White Rh4, Ne4. Black Ke4... can't have king on e4 if Ne4 is there.
  // White Re1, Be3. Black Ke6.
  // Be3 moves, reveals Re1 attacks e6? e1-e6 is the e-file. YES if Be3 is on e3.
  // Move: Be3-b6? or Be3-h6? Any move that uncovers Re1 attacking Ke6.
  // Be3-c5 (diagonal c5): does this work? Be3 moves to c5 (e3-d4-c5, diagonal ✓).
  // After Bc5, Re1 now "sees" e6 directly → discovered check!
  { n:4, fen:'8/8/4k3/8/8/4B3/8/4K1R1 w - - 0 1', move:'e3c5', desc:'Be3-c5 reveals Rg1... wait, need rook on e-file' },

  // Let me fix: Rook on e1, Bishop on e3, Black King on e6.
  // White: Ke1... king can't be on e1 if rook is on e1.
  // White: Kg1, Re1, Be3. Black: Ke6.
  { n:4, fen:'8/8/4k3/8/8/4B3/8/4R1K1 w - - 0 1', move:'e3c5', desc:'Be3-c5 reveals Re1 gives discovered check to Ke6' },

  // Game 5: Middlegame discovered attack — Na3 blocks Ra1 from Qa7
  // Na3-b5 uncovers Ra1 attacks Qa7 (a-file); Nb5 also attacks Qa7 = double attack
  { n:5, fen:'4k3/q1pp4/8/8/8/N7/8/R3K3 w - - 0 1', move:'a3b5', desc:'Na3-b5 reveals Ra1 attacks Qa7; Nb5 also attacks Qa7' },
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
