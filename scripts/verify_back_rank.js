const { Chess } = require('chess.js')

// Back rank mate: queen or rook delivers checkmate on opponent's back rank.
// King trapped by its own pawns (no escape squares).
// best_move = the checkmating move

const tests = [
  // Game 1: Simplest — Rook delivers mate on 8th rank
  // Black King on g8, pawns f7/g7/h7 trap it, White Rook delivers Rd8#
  { n:1, fen:'6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', move:'d1d8', desc:'Rd8# back rank mate (pawns f7/g7/h7 trap Kg8)' },

  // Game 2: Queen delivers back rank mate
  // Black King on h8, pawns g7/h7 trap it (wait g7/h7 with king on h8 means h7 is adjacent)
  // King h8, pawns on f8... let me use: Kg8, pawns g7/h7/f7, White Qd1 → Qd8#
  { n:2, fen:'6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1', move:'d1d8', desc:'Qd8# back rank mate' },

  // Game 3: Rook drops from 6th rank to back rank
  // Black King g8, pawns f7/g7/h7. White Re6 drops to e8#.
  { n:3, fen:'6k1/5ppp/4R3/8/8/8/8/6K1 w - - 0 1', move:'e6e8', desc:'Re6-e8# back rank mate (rook drops from 6th)' },

  // Game 4: Rook battery — rook backs up another on back rank
  // Black King g8, pawn h7 (only). Rooks on 7th rank ready to swing.
  // White Re7, White Rd1. Black Kg8, pawn h7.
  // But Re7 on 7th rank → Re8#? Re7-e8: rank 7 to rank 8 move (same file). If e8 is empty yes.
  // Black Kg8, h7 pawn. King can escape to h8 or f8? If f8 and h8 are not blocked, no mate.
  // Add more pawns: Black Kg8, pawns f8/g7/h7? Wait f8 blocks king escape.
  // Let me use: Black Kg8, pawns on f7/g7/h7. White Ra8, Rd1.
  // Ra8 already on 8th rank — Rd1-d8# since a8 and d8 both on 8th, but d8 might be mate.
  // Better: White Ra1, Rh1. Black Kg8, pawns f7/g7/h7. Ra1-a8#? Yes if nothing on a2-a7.
  { n:4, fen:'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', move:'a1a8', desc:'Ra8# back rank mate' },

  // Game 5: Middlegame feel — sacrifice to clear back rank, then mate
  // White Queen can swing to 8th rank for mate
  // Black: Kg8, pawns f7/g7/h7, Rook on d8 (guard!), Queen c7.
  // White: Qd1, Rd7 (attacking d8), Kg1.
  // White Rxd8 clears the guard, then Qd8#? But that's 2 moves.
  // Single move: White Rd8 (captures Rd8 with check?)
  // White: Kg1, Qh5, pawns. Black: Kg8, pawns g7/h7, Rook f8 (one guard).
  // Qh5-d1? No. Qh5-h8+? h8 is adjacent to Kg8 — Qh8+ if f8 rook guards h8... hmm.
  //
  // Simpler: White can deliver mate in 1 in a slightly complex position.
  // Black: Kg8, Rg7 (own rook blocks!), pawns h7. White: Rg1, Qh4.
  // Qh4-h8#? King on g8, own Rg7 blocks g7. h8 is empty, king on g8 can't go to h8 if Qh8.
  // Qh4-h8: is this checkmate? King on g8, pawn h7, own rook on g7.
  // After Qh8+: king can go to f7? f7 is empty here. Not mate.
  //
  // Let me use a clean back rank mate with extra pieces for distraction:
  // Black: Kg8, pawns f7/g7/h7, Rd8 (extra piece acting as guard/distractor).
  // White: Kg1, Qd1 (attacks d8!), Rf1.
  // Qd1-d8 captures Rd8 AND delivers back rank mate to Kg8!
  // After Qxd8: king on g8, pawns f7/g7/h7 trap it, no escape to 8th rank (Qd8 controls d8),
  // and does Qd8 checkmate? King g8 can go to f8, g9(off board), h8.
  // Wait f8 is not blocked. So not checkmate unless f8 is also controlled.
  // White Rf1-f8 would also be needed. Two moves.
  //
  // Better: add pawn on f8 for Black (or White rook already covers f8).
  // Black: Kg8, pawns f7/g7/h7, Rd8. White: Kg1, Rf8+ scenario.
  // Hmm this gets complex. Let me just use a slightly harder version of game 1/4:
  // Black King on g8, pawns f7/g7/h7 (exact same trap), but White has more pieces to distract.
  // White: Kg1, Re7, Rd1. Move Rd1-d8# — but we need d8 to be empty and the position clear.
  // Position: r5k1/4Rppp/8/8/8/8/8/3R2K1 w - - 0 1
  // White: Kg1, Re7, Rd1. Black: Ra8, Kg8, pawns f7/g7/h7.
  // Move: d1d8# — passes through d2-d7 (Re7 is on e7, not d7). Is d8 empty? Yes. Does Rd8 check Kg8?
  // From d8, rook attacks d-file and 8th rank. King g8 on 8th rank: Rd8 attacks g8! ✓
  // King can go to h8 — but h7 pawn blocks. King can go to f8 — empty! NOT CHECKMATE.
  // Unless f8 is controlled by Re7 (Re7 attacks e7/e-file and 7th rank: f7,g7,h7 and a7-d7).
  // Re7 does NOT control f8. Hmm.
  //
  // For game 5, add a rook on f1 to cover f8:
  // White: Kg1, Re7, Rd1, Rf1. Black: Ra8, Kg8, pawns f7/g7/h7.
  // FEN: r5k1/4Rppp/8/8/8/8/8/3R1RK1 w - - 0 1
  // Move: d1d8# — Rd8 checks Kg8 on 8th rank. King: f8 covered by Rf1. h8 blocked by h7 pawn.
  // g7 pawn on 7th rank blocks king. f7 pawn blocks f7.
  // After Rd8, king squares: f8 (covered by Rf1 ✓), h8 (blocked by h7 pawn ✓). CHECKMATE ✓!
  // Game 5: Rook captures Black's back-rank defender then mates
  // White Ra1 captures Ra8 — Ra8 now covers the entire 8th rank → checkmate
  { n:5, fen:'r5k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', move:'a1a8', desc:'Rxa8# — captures guard and mates on back rank' },
]

for (const p of tests) {
  const b = new Chess(p.fen)
  try {
    const r = b.move({ from: p.move.slice(0,2), to: p.move.slice(2,4) })
    const mate = b.isCheckmate()
    console.log('  ' + (r ? (mate ? 'OK(MATE)' : 'OK(no-mate?)') : 'NULL') + ' #' + p.n + ': ' + p.move + ' — ' + p.desc)
  } catch(e) {
    console.log('  FAIL #' + p.n + ': ' + e.message.slice(0,80) + ' — ' + p.desc)
  }
}
