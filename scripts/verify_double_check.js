const { Chess } = require('chess.js')

// Double check: moving piece gives check AND uncovers a second check.
// King must move — blocking or capturing one checker still leaves the other.
// best_move = the move that delivers the double check (both pieces give check)

const tests = [
  // Game 1: Knight moves to give check, reveals rook check on file
  // White: Kg1, Re1, Nf3. Black: Ke8, some piece.
  // Nf3-g5+: Ng5 gives check? From g5: e4,f3,h3,e6,f7,h7. Not e8.
  // Nf3-d4+: checks king on e6? from d4: b3,f3,b5,f5,c2,e2,c6,e6. e6!
  // But king needs to be on e6 for that.
  // Better: Re1 on e-file, king on e8. Ne3 moves to f5+: f5 checks... f5 attacks e7,g7,d4,h4,d6,h6 - not e8.
  //
  // Classic double check: knight on f5 moves to g7++? No that captures.
  //
  // Nf5-d6++ (double check): Nd6 gives check + reveals bishop behind on b8-diagonal?
  //
  // Simple: White Rh8, Ne6. Black Ke8.
  // Ne6-f8++? Nf8 attacks e6, d7, g6, h7 — not e8 directly.
  //
  // Known simple double check: White Re1, Nd6. Black Ke8.
  // Nd6-f7++ (Nf7 checks Ke8: f7 attacks d8, h8, d6, h6, e5 — NOT e8 either)
  //
  // From e5 a knight attacks: d7, f7, c4, g4, c6, g6, d3, f3
  // Nd6 attacks: c8, e8(!), b7, f7, b5, f5, c4, e4
  // So Nd6 attacks e8! If there's a discovered check from Re1 or Bc4 when Nd6 moves...
  //
  // Wait, to DELIVER a double check, the knight must MOVE to a square that gives check AND its departure reveals another check.
  //
  // White: Re1, Nd4. Black: Ke8 (e-file).
  // Nd4-f5? From f5: d4, h4, d6, h6, e3, g3, e7, g7. Not e8.
  // Nd4-e6+: from e6: d4, f4, c5, g5, c7, g7, d8, f8. Not e8 directly.
  // Nd4-c6+: from c6: b4, a5, b8, a7, d8, e7, e5, d4. Not e8.
  //
  // Hmm. For double check the knight must check the king AND the revealed piece also checks.
  //
  // Let me use a known example:
  // White: Kg1, Bg5, Nf5. Black: Ke8, Qd8, Rf8.
  // Nf5-e7++ (double check): Ne7 gives check to Ke8 (from e7: c6,g6,c8,g8,d5,f5,d9(off board),f9(off board))
  // From e7: c6, g6, c8, g8, d5, f5. NOT e8. So Ne7 doesn't check Ke8.
  //
  // From what squares does a knight check a king on e8?
  // Knight on e8 attacks: c7, g7, c9(off), g9(off), d6, f6, d10(off), f10(off)
  // Reverse: squares that check Ke8 = squares from which knight attacks e8:
  // c7 → from c7 a knight attacks a6,b5,d5,e6,a8,b9(off),d9(off),e8 → YES c7 checks e8!
  // g7 → from g7 attacks e6,f5,h5,e8,f9(off),h9(off) → YES g7 checks e8!
  // d6 → from d6 attacks b5,f5,b7,f7,c4,e4,c8,e8 → YES d6 checks e8!
  // f6 → from f6 attacks d5,h5,d7,h7,e4,g4,e8,g8 → YES f6 checks e8!

  // So a knight on d6, f6, c7, or g7 gives check to king on e8.

  // Double check scenario:
  // White: Kg1, Re1, Nd4. Black: Ke8, other pieces.
  // Nd4-f5: f5 attacks d4,h4,d6,h6,e3,g3,e7,g7. Not e8.
  // Nd4-c6: c6 attacks b4,a5,b8,a7,d8,e7,e5,d4. Not e8.
  // Nd4 needs to reach d6, f6, c7, or g7 to check Ke8.
  // Nd4-f5? No. Nd4 can reach: b3,f3,b5,f5,c2,e2,c6,e6. None of these check Ke8.
  //
  // Let me use a different starting square for the knight.
  // Knight needs to check Ke8 from d6, f6, c7, or g7.
  // And the move of the knight must also reveal a check from a line piece.
  //
  // Knight on c4 can reach: a3, e3, a5, e5, b2, d2, b6, d6(!).
  // Nc4-d6+: d6 checks Ke8 (as above). Also, if there's a rook on the c-file revealed by Nc4 moving? No, knight is on c4 not blocking a rank/file.
  // What's on the c-file behind Nc4? If White has Rc1 on c1, and Nc4 moves to d6, Rc1 attacks c7,c8 etc. But Black king is on e8, not the c-file. No discovered check there.
  //
  // What if there's a bishop aimed at e8?
  // White: Kg1, Ba3, Nc4. Black: Ke8.
  // Ba3 diagonal: a3-b4-c5-d6-e7-f8. Nc4 is on c4, NOT on the a3 diagonal.
  // After Nc4-d6+: the knight checks Ke8. But what second check? Ba3 doesn't give check to e8.
  //
  // White: Kg1, Bd3, Ne5. Black: Ke8.
  // Bd3 diagonal: d3-e4-f5-g6-h7 (one way) or d3-c2-b1 (other) or d3-e2-f1 (another) or d3-c4-b5-a6 (fourth).
  // None of Bd3's diagonals hits e8 directly without being blocked.
  //
  // Let me try: White Bh5, Ne4. Black Ke8.
  // Bh5 diagonal: h5-g6-f7-e8! YES! Bh5 attacks e8 (if nothing is blocking).
  // If Ne4 is blocking? h5-g6-f7-e8: ne4 is on e4, NOT on this diagonal (which goes through g6, f7, e8).
  // So Bh5 already checks Ke8 (through h5-g6-f7-e8 if g6 and f7 are empty)!
  //
  // For a double check: the knight moves (Ne4 to some square that checks e8 AND the move reveals Bh5 check).
  // But Bh5 already checks e8 unless something is blocking on g6 or f7.
  //
  // White: Kg1, Bh5, Nf7. Black: Ke8 (and Nf7 blocks Bh5 from checking!).
  // Wait, Nf7 is a WHITE knight on f7 that blocks Bh5 from checking Ke8 via h5-g6-f7-e8.
  // Nf7 moves → reveals Bh5 gives check to Ke8.
  // If Nf7 moves to d6+ (d6 checks Ke8!) or to some other square that ALSO checks Ke8:
  // Nf7 can reach: d6, h6, d8, h8, e5, g5.
  // Nf7-d6+: both Nd6 checks Ke8 AND Bh5 now checks Ke8 (f7 unblocked). DOUBLE CHECK!
  //
  // But wait: h5-g6-f7(empty after Nf7 moves)-e8: NEED g6 to be empty too. If g6 is empty, YES!

  // Position: White Kg1, Bh5, Nf7. Black Ke8.
  // FEN: `4k3/5N2/8/7B/8/8/8/6K1 w - - 0 1`
  // Move: f7d6 (Nf7-d6++) — double check: Nd6 checks Ke8, Bh5 (via g6-f7-e8 now clear) checks Ke8
  { n:1, fen:'4k3/5N2/8/7B/8/8/8/6K1 w - - 0 1', move:'f7d6', desc:'Nf7-d6++ double check: Nd6+Bh5' },

  // Game 2: Rook reveals bishop check, rook also gives check
  // White: Kg1, Bc4, Rh8. Black: Ke8.
  // If Rh8 moves AND gives check AND reveals Bc4 check...
  // Bc4 diagonal: c4-d5-e6-f7-g8 (up-right). NOT hitting e8 directly.
  // Bc4-d5-e6: king on e6 would be checked. King on e8: c4-d5-e6-f7-g8, NOT e8.
  //
  // What bishop diagonal hits e8?
  // e8 has two relevant diagonals for checking:
  // 1) b5-c6-d7-e8: bishop on b5 (or further: a4) attacks e8
  // 2) h5-g6-f7-e8: bishop on h5 attacks e8
  // 3) a4-b5-c6-d7-e8: same as (1) going further
  // 4) f7-g6-h5 other direction, or b5-c6-d7 is (1)
  //
  // White: Kg1, Bd7 (on d7, blocks e8), Re1. Black: Ke8.
  // If Bd7 moves to a4+ (check), AND Re1 also checks: Re1-e8? Bd7 was blocking Re1 from e8 (d7 is not on e-file). No.
  //
  // Let me use: White: Kg1, Bf7 (on f7, blocking the e8 check line? no), Rd1. Black: Ke8.
  //
  // Actual double check with rook + bishop:
  // White Rd7 on d7 (blocking the d-file view from Rd1 to Ke8? No, king is on e8 not d8).
  //
  // White Bh4, Rh5 → Rh5-e5+ (rook moves on rank to e5, giving check to king on e5? No king is on e8)
  //
  // Let me use another known double check:
  // White: Kg1, Re8 is not possible (can't be on same square as king).
  //
  // Simpler: White Nf6+, discovers Rg1-g8+?
  // White: Kg2, Rg1, Nf6 (on g-file? No, Nf6 is not on g-file).
  //
  // OK let me just use another knight revealed check:
  // White: Kg1, Bg5, Nd4. Black: Ke8, Nd7 (black knight distracts).
  // Nd4-e6+: from e6: d4,f4,c5,g5(bishop!),c7,g7,d8,f8. Bg5 is on g5 which Ne6 attacks but...
  // Actually Ne6 CAPTURES Bg5? No, Ne6 from e6 attacks c5, g5, c7, g7, d4, f4, d8, f8.
  // Wait, knight ATTACKS g5 from e6, but cannot CAPTURE own piece. So this doesn't work.
  //
  // Let me just use a clean, simple double check for game 2:
  // White: Kg1, Ra8, Nc7. Black: Ke8.
  // Nc7-a6: from a6: b4, c5, b8, c7(where it was), but that's circular.
  // Or: Nc7-e6+: Ke8 checked by Ne6 (e6 attacks d8,f8,c7,g7,c5,g5,d4,f4 - NOT e8!)
  //
  // I keep making the same mistake. Let me ONLY consider moves where the knight lands on d6, f6, c7, or g7 to check e8:
  //
  // White: Kg1, Bd3, Ne4. Black: Ke8.
  // Bd3 diagonal to e8: d3-e4-..? No. What diagonal from Bd3 reaches e8?
  // d3-c4-b5-a6 (one diagonal), d3-e4-f5-g6-h7 (another), d3-c2-b1 (third), d3-e2-f1 (fourth).
  // None of these hit e8.
  //
  // Let me try Bc4 diagonal to e8: c4-b5-a6 (away from e8) or c4-d5-e6-f7-g8 (doesn't hit e8).
  // Wait: is there a diagonal from c4 to e8? Diagonals go at 45° angles.
  // c4=(3,4), e8=(5,8): delta (2,4). For a diagonal, |delta_file| = |delta_rank|. Here |2| ≠ |4|. NOT a diagonal!
  //
  // White: Kg1, Bb5, Ne5. Black: Ke8.
  // Bb5 diagonal: b5-c6-d7-e8! YES! Bb5 attacks e8 (via c6, d7).
  // Ne5 is on e5, NOT on the b5-c6-d7-e8 diagonal.
  // But does Ne5 block Bb5's view of Ke8? b5-c6-d7-e8: Ne5 is on e5, not on this line. So Bb5 already checks Ke8 if c6 and d7 are empty!
  //
  // For a double check, I need a piece that IS blocking Bb5's view, then moves to give check itself.
  // If Black has a piece on c6 or d7 that blocks Bb5:
  // White: Kg1, Bb5, Nd7 (white knight on d7 blocking Bb5 from e8). Black: Ke8.
  // Nd7-f6+: Nf6 checks Ke8 (f6 attacks d5,h5,d7,h7,e4,g4,e8,g8 → YES e8!).
  // Also, Nd7 moves OFF d7, revealing Bb5-c6-d7(empty)-e8 → Bb5 gives check!
  // DOUBLE CHECK!
  { n:2, fen:'4k3/3N4/8/1B6/8/8/8/6K1 w - - 0 1', move:'d7f6', desc:'Nd7-f6++ double check: Nf6+Bb5' },

  // Game 3: Slightly more complex — rook on e-file, knight blocks
  // White: Kg1, Re1, Ne4. Black: Ke8.
  // Ne4 is on e4 (blocking Re1 from seeing e8? e1-e2-e3-e4-e5-e6-e7-e8: YES, Ne4 blocks!).
  // Ne4 moves to c5+? from c5: b3,d3,b7,a6,d7,e6,e4,a4 — NOT e8.
  // Ne4 moves to d6+: from d6: c4,e4,b5,f5,b7,f7,c8,e8 → e8 ✓!
  // Nd6 gives check AND reveals Re1-e8 (e4 now empty). DOUBLE CHECK!
  { n:3, fen:'4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1', move:'e4d6', desc:'Ne4-d6++ double check: Nd6+Re1 on e-file' },

  // Game 4: Harder — pieces on both sides
  // White: Kg1, Bb2, Nc3. Black: Ke8, other pieces.
  // Bb2 diagonal: b2-c3-d4-e5-f6-g7-h8. King on e8: b2-c3(Nc3 blocks!)-d4-e5: NOT hitting e8.
  // Wait: Bb2 diagonal b2-c1 (down-left) or b2-a3 (up-left) or b2-c3-d4-e5-f6-g7-h8 (up-right) or b2-a1 (down-left).
  // b2-c3-d4-e5-f6-g7-h8 doesn't hit e8.
  // Bb2 toward e5: b2(2,2)-c3(3,3)-d4(4,4)-e5(5,5)-f6(6,6)-g7(7,7)-h8(8,8). NOT e8.
  //
  // What if Bb2 diagonal goes toward f6-e7-d8-c7... ?
  // b2 has 4 diagonals: up-right: c3-d4-e5-f6-g7-h8; up-left: a3; down-right: c1; down-left: a1.
  // None hit e8 directly.
  //
  // Let me use Bc3 diagonal: c3-b4-a5 or c3-d4-e5-f6-g7-h8 or c3-b2-a1 or c3-d2-e1.
  // b5 diagonal hits e8? b5-c6-d7-e8: YES! So Bb5 hits e8.
  //
  // For a harder game 4, more pieces but same idea:
  // White: Kg1, Bb5, Nc6. Black: Ke8, Ra8, Qd7 (blocking b5-e8 diagonal!).
  // Qd7 is on d7, blocking Bb5's attack on e8.
  // If White's Nc6 moves and gives check to Ke8, AND also reveals Bb5-c6(empty)-d7... wait d7 has black queen. Bb5-c6-d7: this DOES NOT give check because d7 is the queen, not the king. The Queen blocks Bb5 from seeing Ke8 on d7.
  //
  // Hmm, for double check the KING needs to be the target of both checks.
  //
  // White: Kg1, Bb5, Nc6 (blocking Bb5 from c6? b5-c6: YES, Nc6 would be on the b5-e8 diagonal!).
  // Nc6 is White (blocking own bishop), Black King on e8.
  // If Nc6 moves to d8+: Nd8 attacks c6,e6,b7,f7 — NOT e8.
  // If Nc6 moves to e7+: Ne7 attacks c6,g6,c8,g8,d5,f5 — NOT e8.
  // None of the knight moves from c6 check Ke8.
  //
  // Knight from c7 checks Ke8 (c7 attacks a6,b5,b9off,d9off,a8,e6,e8 — YES e8!).
  // So if White Nc6 moves to a square that checks, OR if another knight on c7...
  //
  // This is getting complex. For Game 4, let me reuse the Nf7 pattern but with more pieces:
  // White: Kg1, Bh5, Nf7 (same as game 1 but with extra pieces for distraction).
  // Extra: Black has Rook on d8, Pawn on e6.
  // FEN: `3rk3/5N2/4p3/7B/8/8/8/6K1 w - - 0 1`
  { n:4, fen:'3rk3/5N2/4p3/7B/8/8/8/6K1 w - - 0 1', move:'f7d6', desc:'Nf7-d6++ with Rd8/Pe6 as distractors' },

  // Game 5: Full middlegame feel
  // White: Kg1, Bb5, Nd7 (mirrors game 2 but with more pieces)
  // Black: Ke8, Ra8, Qc8, pawns
  // FEN: `r1qk4/3N1ppp/8/1B6/8/8/6PP/6K1 w - - 0 1`
  // Move: d7f6 (same pattern as game 2, harder position)
  { n:5, fen:'r1qk4/3N1ppp/8/1B6/8/8/6PP/6K1 w - - 0 1', move:'d7f6', desc:'Nd7-f6++ in middlegame (Bb5 revealed)' },
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
