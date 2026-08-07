"""Validate every design in fork_examples.FORK_EXAMPLES.

Usage: python -m chess_pipeline.check_fork_examples
Prints PASS/FAIL per design; exit 1 on any failure.
"""

import sys

import chess

from chess_pipeline.design_tools import board_from_san_line
from chess_pipeline.fork_examples import FORK_EXAMPLES
from chess_pipeline.pattern_detectors import DETECTORS


def check(design: dict) -> list[str]:
    errs = []
    try:
        board, moves = board_from_san_line(design["line"])
    except ValueError as e:
        return [f"line parse error: {e}"]

    if len(moves) < 15:
        errs.append(f"only {len(moves)} plies (need >= 15)")

    expected = chess.WHITE if design["side"] == "white" else chess.BLACK
    if board.turn != expected:
        errs.append(
            f"side to move is {'white' if board.turn else 'black'}, "
            f"expected {design['side']}"
        )
        return errs

    try:
        move = board.parse_san(design["best_move_san"])
    except ValueError as e:
        errs.append(f"best move illegal: {e}")
        return errs

    if not DETECTORS[design["pattern"]](board, move):
        errs.append(
            f"{design['best_move_san']} fails the "
            f"{design['pattern']} detector"
        )
    return errs


def main():
    failed = 0
    for d in FORK_EXAMPLES:
        label = (
            f"fork #{d['game_number']} [{d.get('fork_type','?')}] "
            f"({d['title']})"
        )
        errs = check(d)
        if errs:
            failed += 1
            print(f"[FAIL] {label}")
            for e in errs:
                print(f"       - {e}")
        else:
            board, moves = board_from_san_line(d["line"])
            print(f"[ OK ] {label}: {len(moves)} plies, {d['best_move_san']}")

    total = len(FORK_EXAMPLES)
    print(f"\n{total - failed}/{total} fork examples pass")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
