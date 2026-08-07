"""Validate a single authored line + pattern move.

Usage: python -m chess_pipeline.check_line <pattern> "<full SAN line>" <student-move-SAN>

Reports: ply count, legality, detector verdict, ALL detector-positive
moves in the final position (uniqueness check), and target explanation.
"""

import sys

import chess

from chess_pipeline.design_tools import board_from_san_line, pattern_hits
from chess_pipeline.pattern_detectors import DETECTORS, piece_value


def explain_targets(board: chess.Board, move: chess.Move) -> str:
    after = board.copy()
    after.push(move)
    sq = move.to_square
    mover = after.piece_at(sq)
    out = [f"mover: {mover.symbol()} on {chess.square_name(sq)}"]
    enemy = not mover.color
    for t in after.attacks(sq):
        victim = after.piece_at(t)
        if victim and victim.color == enemy:
            defended = bool(after.attackers(enemy, t))
            out.append(
                f"  attacks {victim.symbol()} on {chess.square_name(t)} "
                f"(value {piece_value(victim)}, {'defended' if defended else 'undefended'})"
            )
    if after.is_check():
        out.append(f"  gives check ({len(after.checkers())} checker(s))")
    return "\n".join(out)


def main():
    pattern, line_san, move_san = sys.argv[1], sys.argv[2], sys.argv[3]
    board, moves = board_from_san_line(line_san)
    print(f"plies: {len(moves)}  side to move: {'white' if board.turn else 'black'}")
    print(f"fen: {board.fen()}")

    move = board.parse_san(move_san)
    detector = DETECTORS[pattern]
    print(f"detector({pattern}, {move_san}): {detector(board, move)}")
    print(explain_targets(board, move))

    hits = pattern_hits(board, pattern)
    print(f"all {pattern} hits in position: {[board.san(m) for m in hits]}")


if __name__ == "__main__":
    main()
