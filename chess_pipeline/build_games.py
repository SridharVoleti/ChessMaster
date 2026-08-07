"""Build the scripted-games JSON from authored designs (format v2).

Reads PRACTICE_DESIGNS (and MAIN_DESIGNS, when defined) from
chess_pipeline.game_designs, validates every design with the pattern
detectors, and emits one JSON array of game rows.

Practice rows keep every field the game UI reads (pattern, game_number,
title, pattern_fen, best_move, setup_fen, pgn, side) plus opening/story.
Main rows additionally carry game_type="main", target_patterns and
checkpoints; their pgn is the full drive mainline including expected
student moves.

Usage:  python -m chess_pipeline.build_games [path/to/out.json]
Exit 0 = written. Exit 1 = a design failed validation; nothing written.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import chess

from chess_pipeline import game_designs
from chess_pipeline.design_tools import board_from_san_line
from chess_pipeline.pattern_detectors import DETECTORS

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "scripts" / "scripted_games_data.json"


def build_practice_row(design: dict) -> dict:
    """Compute the derived fields (pattern_fen, best_move UCI) for one
    practice design. Raises ValueError if the design is invalid."""
    board, moves = board_from_san_line(design["line"])
    if len(moves) < 15:
        raise ValueError(f"only {len(moves)} plies (need >= 15)")
    move = board.parse_san(design["best_move_san"])
    if not DETECTORS[design["pattern"]](board, move):
        raise ValueError(
            f"{design['best_move_san']} fails the {design['pattern']} detector"
        )
    return {
        "pattern":     design["pattern"],
        "game_number": design["game_number"],
        "game_type":   "practice",
        "title":       design["title"],
        "opening":     design["opening"],
        "story":       design["story"],
        "pattern_fen": board.fen(),
        "best_move":   move.uci(),
        "setup_fen":   chess.STARTING_FEN,
        "pgn":         design["line"] + " *",
        "side":        design["side"],
    }


def build_main_row(design: dict) -> dict:
    """Build one main-game row. The mainline must be legal; every
    checkpoint ply must be a student move passing its detector."""
    board = chess.Board()
    _, moves = board_from_san_line(design["line"])
    positions = []
    for mv in moves:
        positions.append(board.copy())
        board.push(mv)

    student = chess.WHITE if design["side"] == "white" else chess.BLACK
    targets = set(design["target_patterns"])
    for cp in design["checkpoints"]:
        ply, pat = cp["ply"], cp["pattern"]
        if pat not in targets:
            raise ValueError(f"checkpoint ply {ply}: '{pat}' not in target_patterns")
        if ply >= len(moves):
            raise ValueError(f"checkpoint ply {ply} beyond end of mainline")
        if positions[ply].turn != student:
            raise ValueError(f"checkpoint ply {ply} is not a student move")
        if not DETECTORS[pat](positions[ply], moves[ply]):
            raise ValueError(
                f"checkpoint ply {ply}: {moves[ply].uci()} fails the {pat} detector"
            )

    return {
        "pattern":         design["pattern"],
        "game_number":     design.get("game_number", 6),
        "game_type":       "main",
        "title":           design["title"],
        "opening":         design["opening"],
        "story":           design["story"],
        "setup_fen":       chess.STARTING_FEN,
        "pgn":             design["line"] + " *",
        "side":            design["side"],
        "target_patterns": design["target_patterns"],
        "checkpoints":     design["checkpoints"],
    }


def build_all(practice_designs: list[dict], main_designs: list[dict]) -> list[dict]:
    rows: list[str | dict] = []
    errors: list[str] = []
    for d in practice_designs:
        label = f"{d['pattern']} #{d['game_number']} ({d['title']})"
        try:
            rows.append(build_practice_row(d))
        except ValueError as e:
            errors.append(f"{label}: {e}")
    for d in main_designs:
        label = f"{d['pattern']} MAIN ({d['title']})"
        try:
            rows.append(build_main_row(d))
        except ValueError as e:
            errors.append(f"{label}: {e}")
    if errors:
        raise ValueError("\n".join(errors))
    return rows


def main(argv: list[str]) -> int:
    out = Path(argv[1]) if len(argv) > 1 else DEFAULT_OUT
    practice = game_designs.PRACTICE_DESIGNS
    mains = getattr(game_designs, "MAIN_DESIGNS", [])
    try:
        rows = build_all(practice, mains)
    except ValueError as e:
        print(f"[FAIL] designs invalid, nothing written:\n{e}")
        return 1
    out.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} games ({len(practice)} practice, {len(mains)} main) -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
