const { Chess } = require('chess.js')

// Zwischenzug: instead of expected recapture/response, play an "in-between" move
// that is even stronger (usually a check or threat that must be dealt with first).
// best_move = the zwischenzug (the intermezzo move, NOT the obvious recapture)

const tests = [
  // Game 1: After White captures a piece, Black has a zwischenzug check instead of recapturing.
  // But we play as White finding the zwischenzug, so:
  // White expected to recapture but instead plays a check that wins material.
  // White: Kg1, Qd1, Rd7 (on 7th rank). Black: Ke8, Qc6, Rc1 (attacking Qd1 and Rd7).
  // Expected: Rxc1 (recapture). Zwischenzug: Rd7xe7+ (discovered check or strong check).
  //
  // Simpler: White expected to recapture on e4. Instead plays Nf6+ (check) first.
  // White: Kg1, Nd5 (attacks e7/c7), Ne4 (attacked by Black Bd6). Black: Ke8, Bd6 (attacks Ne4), Qd7.
  // Expected: White recaptures (Nxd6 or similar). Zwischenzug: Nd5-f6+ (check on king), wins after.
  // White: Kg1, Nf3, Ne4 is attacked. Black: Ke8, Bd6, Qc7.
  // Hmm. Let me simplify:
  //
  // Classic Zwischenzug: White is expected to defend, but instead delivers a check first.
  // White: Kg1, Qe2, Nd4. Black: Ke8, Re1 (attacking Qe2!).
  // Expected: Qxe1 or Nxe1 (capture the attacking rook).
  // Zwischenzug: Nd4-f5+ (check to Ke8!). Black must respond to check. Then Qxe1.
  // Nd4-f5 check? From f5: d4,h4,d6,h6,e3,g3,e7,g7. NOT e8. Doesn't check Ke8.
  // From which squares does a knight check e8? d6, f6, c7, g7 (as established earlier).
  // Nd4 can reach: b3,f3,b5,f5,c2,e2,c6,e6. None of d6/f6/c7/g7.
  //
  // Ne3 can reach d6 (checks e8)! So if the knight is on e3...
  // Nd5 can reach... d5: b4,f4,b6,f6(!),c3,e3,c7(!),e7. f6 checks e8, c7 checks e8!
  // Nd5-f6+! (checks Ke8) OR Nd5-c7+! (checks Ke8)
  //
  // Position: White: Kg1, Qe2, Nd5. Black: Ke8, Re2 (attacking Qe2).
  // Wait Re2 and Qe2 on same square — can't be.
  // White Qe1. Black Re8 (guards back rank?) — hmm.
  //
  // Let me use a very clean example:
  // White: Kg1, Rf3, Nd5. Black: Ke8, Rd3 (attacking Rf3!), Qd8.
  // Expected: Rxd3 (captures the attacking rook).
  // Zwischenzug: Nd5-f6+ (check to Ke8). Black must deal with check. Then Rxd3.
  // Nd5 to f6: from d5 (4,5) to f6 (6,6): delta (+2,+1) — valid knight L-shape ✓
  // Nf6 attacks e8 ✓ (checking Ke8)
  { n:1, fen:'3qk3/8/8/3N4/8/5R2/8/6K1 w - - 0 1', move:'d5f6', desc:'Nd5-f6+ (zwischenzug check) instead of responding to threat' },

  // But wait: what is the "threat" Black has that White is ignoring?
  // In position '3qk3/8/8/3N4/8/5R2/8/6K1', there's no black piece attacking White.
  // For a proper zwischenzug lesson, there should be a black piece threatening White.
  // Black Rook on f4 attacking White Rf3? Let me revise.
  //
  // Actually for a CHILDREN's lesson, maybe the zwischenzug concept just means:
  // "before you recapture, play this better move first"
  // So: Black just captured a White piece. Instead of recapturing immediately,
  // White plays a check/strong move that is even more powerful.
  //
  // Game 1: Simplified — White finds check instead of obvious recapture.
  // White: Kg1, Nd5, Bishop gone. Black: Ke8, Bxd1 (black just captured a piece on d1).
  // No wait, let's keep it simple: White has a check AND a capture but checks first.
  // White: Kg1, Nd5, Re1. Black: Ke8, Rd1 (attacks Re1 at a distance? No, Re1/Rd1 same rank).
  // Rd1 attacks Re1? They're both on rank 1. Yes, Rd1 attacks Re1 (rook on d1 attacks to e1).
  // Expected: Rxd1 (capture Rd1). Zwischenzug: Nd5-f6+ (check to Ke8). Then Rxd1 next.
  { n:1, fen:'4k3/8/8/3N4/8/8/8/3rR1K1 w - - 0 1', move:'d5f6', desc:'Nd5-f6+ zwischenzug (check before Rxd1)' },

  // Game 2: White has pawn threatened. Zwischenzug: deliver check first.
  // White: Kg1, Ne5, Pe4. Black: Ke8, Bxe4 (Black just took pawn? Or black bishop on d5 threatens e4).
  // White Ne5 is attacked by something. Black Rd5 threatens Ne5.
  // Expected: Ne5 moves to safety. Zwischenzug: Ne5-f7+ (Royal fork check!).
  // Ne5-f7: from f7 attacks d6,h6,d8,h8,e5,g5 — NOT e8 directly. Wait: from f7 attacks e5,g5,d6,h6,d8,h8.
  // Hmm, does Nf7 check Ke8? From f7: attacks d6,h6,d8,h8... wait let me recalc.
  // Knight from f7 (6,7): (+2,+1)=h8; (+2,-1)=h6; (-2,+1)=d8; (-2,-1)=d6; (+1,+2)=g9(off); (+1,-2)=g5; (-1,+2)=e9(off); (-1,-2)=e5.
  // So Nf7 attacks: h8, h6, d8, d6, g5, e5. NOT e8!
  //
  // For Nf7 to check Ke8, king would need to be on d8/h8/d6/h6/g5/e5. King on d8?
  // Let me use king on d8: White Ne5-f7+ checks Kd8. Zwischenzug before responding to...
  //
  // Game 2: White Ne5 is attacked by Black Bd6. Instead of retreating, Ne5-f7+ checks Kd8.
  // White: Kg1, Ne5. Black: Kd8, Bd6 (attacks Ne5!).
  // Expected: Ne5 retreats. Zwischenzug: Ne5-f7+ (check to Kd8 from f7? f7 attacks d8 — YES!).
  // f7(6,7) attacks d8(4,8): delta (-2,+1) — valid knight move ✓ AND checks Kd8 ✓!
  { n:2, fen:'3k4/8/3b4/4N3/8/8/8/6K1 w - - 0 1', move:'e5f7', desc:'Ne5-f7+ zwischenzug check instead of retreating from Bd6' },

  // Game 3: After Black captures White's queen, White has a check first before recapturing.
  // White: Kg1, Nd5, Re2. Black: Ke8, Qxe2 (black just captured White's rook on e2 -- use simpler setup).
  // White: Kg1, Nd5, Ra2 attacked by nothing but strong check available.
  // Actually let me use: White plays zwischenzug Nd5-c7+ (checks Ke8) before recapturing.
  // Position: White Kg1, Nd5, Rb2. Black: Ke8, Rb8 (targeting White Rb2).
  // Expected: Rxb8 (or Rb2xb8?). Zwischenzug: Nd5-c7+ (check Ke8). Then recapture.
  // Nd5-c7: from d5(4,5) to c7(3,7): delta (-1,+2) — valid knight L-shape ✓.
  // Nc7 attacks e8? from c7(3,7): (+2,+1)=e8 ✓! YES, Nc7 checks Ke8!
  { n:3, fen:'1r2k3/8/8/3N4/8/8/1R6/6K1 w - - 0 1', move:'d5c7', desc:'Nd5-c7+ zwischenzug before Rxb8' },

  // Game 4: Harder — more pieces, similar zwischenzug concept
  // White: Kg1, Nd5, Qe2. Black: Ke8, Qd2 (attacks Qe2).
  // Expected: Qxd2. Zwischenzug: Nd5-f6+ (check). Then Qxd2.
  // FEN: 4k3/8/8/3N4/8/8/3q2Q1/6K1 -- wait, let me recalc
  // '4k3/8/8/3N4/8/8/3q2Q1/6K1 w - - 0 1': rank2=3q2Q1 means d2=q(black), g2=Q(white)
  // Nd5-f6+: checks Ke8 ✓. Then White Qxd2 wins the queen.
  { n:4, fen:'4k3/8/8/3N4/8/8/3q2Q1/6K1 w - - 0 1', move:'d5f6', desc:'Nd5-f6+ zwischenzug before Qxd2' },

  // Game 5: Full middlegame — forced zwischenzug to win material
  // White: Kg1, Nd5, Re1, pawns. Black: Ke8, Qd2, Rd8, pawns.
  // White expected to exchange. Zwischenzug: Nd5-c7+ (fork-check!).
  { n:5, fen:'3rk3/1pp5/8/3N4/8/8/3q4/4R1K1 w - - 0 1', move:'d5c7', desc:'Nd5-c7+ fork-zwischenzug before Rxd8' },
]

for (const p of tests) {
  const b = new Chess(p.fen)
  try {
    const r = b.move({ from: p.move.slice(0,2), to: p.move.slice(2,4) })
    const check = b.isCheck()
    console.log('  ' + (r ? (check ? 'OK(check)' : 'OK(no-check?)') : 'NULL') + ' #' + p.n + ': ' + p.move + ' — ' + p.desc)
  } catch(e) {
    console.log('  FAIL #' + p.n + ': ' + e.message.slice(0,80) + ' — ' + p.desc)
  }
}
