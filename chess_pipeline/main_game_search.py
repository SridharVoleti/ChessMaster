"""Search a full main-game drive-line.

A main game is one legal mainline from the standard start in which the
student hits an ordered sequence of pattern checkpoints. This tool chains
single-pattern setup searches: at each stage it searches plausible
continuations for a detector-positive student move, plays it (recording a
checkpoint), resolves the payoff (the opponent rescues its most valuable
hanging piece, the student collects hanging loot), then searches for the
next pattern. Backtracks across candidate setups per stage.

A mating pattern (e.g. back_rank_mate) must be the last in the sequence —
the game ends there.

Usage:
  python -m chess_pipeline.main_game_search <student> "<base SAN>" <p1,p2,...> [max_extra]
"""

from __future__ import annotations

import sys

import chess

from chess_pipeline.design_tools import (
    board_from_san_line,
    find_pattern_setups,
    line_to_san,
)
from chess_pipeline.pattern_detectors import is_move_safe, piece_value


def _static_hanging(board: chess.Board, sq: chess.Square) -> bool:
    """Static (side-to-move-agnostic) check: piece on sq is attackable at
    a profit — attacked while undefended, or by a cheaper attacker."""
    piece = board.piece_at(sq)
    attackers = board.attackers(not piece.color, sq)
    if not attackers:
        return False
    if not board.attackers(piece.color, sq):
        return True
    min_attacker = min(piece_value(board.piece_at(a)) for a in attackers)
    return min_attacker < piece_value(piece)


def hanging_loss(board: chess.Board, color: chess.Color) -> int:
    """Value of the most valuable hanging piece `color` has on the board."""
    worst = 0
    for sq, piece in board.piece_map().items():
        if (piece.color == color and piece.piece_type != chess.KING
                and _static_hanging(board, sq)):
            worst = max(worst, piece_value(piece))
    return worst


def choose_cpu_reply(board: chess.Board) -> chess.Move | None:
    """Most natural damage-limiting reply: minimise own hanging material
    after the move, counting any capture as compensation."""
    cpu = board.turn
    best, best_key = None, None
    for mv in board.legal_moves:
        gain = piece_value(board.piece_at(mv.to_square)) if board.is_capture(mv) else 0
        after = board.copy()
        after.push(mv)
        # net material still in the wind after the reply
        key = (hanging_loss(after, cpu) - gain,
               0 if board.piece_at(mv.from_square).piece_type != chess.KING else 1)
        if best_key is None or key < best_key:
            best, best_key = mv, key
    return best


def choose_collect(board: chess.Board) -> chess.Move | None:
    """Best materially-winning capture, if any (the tactic's loot).
    Net gain = victim value, minus the capturer if it can be recaptured."""
    best, best_gain = None, 0
    for mv in board.legal_moves:
        if not board.is_capture(mv):
            continue
        victim_val = piece_value(board.piece_at(mv.to_square))
        after = board.copy()
        after.push(mv)
        gain = victim_val
        if not is_move_safe(after, mv.to_square):
            gain -= piece_value(board.piece_at(mv.from_square))
        if gain >= 2 and gain > best_gain:
            best, best_gain = mv, gain
    return best


def find_main_line(base_san: str, patterns: list[str], student: str,
                   max_extra: int = 5, setups_per_stage: int = 5):
    """Return (moves, checkpoints) for the first full drive-line found,
    or None. checkpoints = [(ply, pattern), ...]."""
    _, base_moves = board_from_san_line(base_san)

    def replay(moves: list[chess.Move]) -> chess.Board:
        board = chess.Board()
        for mv in moves:
            board.push(mv)
        return board

    def stage(line: list[chess.Move], remaining: list[str],
              checkpoints: list[tuple[int, str]]):
        if not remaining:
            return line, checkpoints
        pattern = remaining[0]
        setups = find_pattern_setups(line_to_san(line), pattern, student,
                                     max_extra_plies=max_extra,
                                     allow_captures=True)
        for s in setups[:setups_per_stage]:
            new_line = line + s.extra_moves + [s.pattern_move]
            cps = checkpoints + [(len(line) + len(s.extra_moves), pattern)]
            board = replay(new_line)
            if board.is_checkmate():
                if len(remaining) == 1:
                    return new_line, cps
                continue  # mate mid-sequence: cannot continue this branch
            # payoff: opponent limits damage, student collects loot
            reply = choose_cpu_reply(board)
            if reply is None:
                continue
            board.push(reply)
            new_line = new_line + [reply]
            collect = choose_collect(board)
            if collect is not None:
                board.push(collect)
                new_line = new_line + [collect]
            found = stage(new_line, remaining[1:], cps)
            if found:
                return found
        return None

    return stage(list(base_moves), list(patterns), [])


def main():
    student, base, pats = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
    max_extra = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    found = find_main_line(base, pats, student, max_extra=max_extra)
    if not found:
        print("(no drive-line found)")
        sys.exit(1)
    moves, checkpoints = found
    board = chess.Board()
    san_by_ply = []
    for mv in moves:
        san_by_ply.append(board.san(mv))
        board.push(mv)
    print(f"plies: {len(moves)}")
    print(f"line: {line_to_san(moves)}")
    for ply, pattern in checkpoints:
        print(f"checkpoint ply {ply}: {san_by_ply[ply]} ({pattern})")
    print(f"final fen: {board.fen()}")


if __name__ == "__main__":
    main()
