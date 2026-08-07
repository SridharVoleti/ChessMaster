"""Parametrised tests for chess_pipeline.pattern_detectors.

Driven by the authored game designs so every shipped position is
covered without hardcoding moves or FENs in the tests themselves.
"""

import json
from pathlib import Path

import chess
import pytest

from chess_pipeline.design_tools import board_from_san_line, pattern_hits
from chess_pipeline.game_designs import MAIN_DESIGNS, PRACTICE_DESIGNS
from chess_pipeline.pattern_detectors import DETECTORS, is_move_safe

DATA_PATH = Path(__file__).resolve().parent.parent / "scripts" / "scripted_games_data.json"


def practice_id(design):
    return f"{design['pattern']}-{design['game_number']}"


# ── Practice designs ──────────────────────────────────────────────
@pytest.mark.parametrize("design", PRACTICE_DESIGNS, ids=practice_id)
def test_practice_best_move_passes_detector(design):
    board, moves = board_from_san_line(design["line"])
    move = board.parse_san(design["best_move_san"])
    assert DETECTORS[design["pattern"]](board, move)


@pytest.mark.parametrize("design", PRACTICE_DESIGNS, ids=practice_id)
def test_practice_intro_is_long_enough(design):
    _, moves = board_from_san_line(design["line"])
    assert len(moves) >= 15


@pytest.mark.parametrize("design", PRACTICE_DESIGNS, ids=practice_id)
def test_practice_best_move_is_listed_by_pattern_hits(design):
    board, _ = board_from_san_line(design["line"])
    move = board.parse_san(design["best_move_san"])
    assert move in pattern_hits(board, design["pattern"])


# ── Main-game designs ─────────────────────────────────────────────
def checkpoint_cases():
    for design in MAIN_DESIGNS:
        for cp in design["checkpoints"]:
            yield pytest.param(
                design, cp, id=f"{design['pattern']}-main-ply{cp['ply']}"
            )


@pytest.mark.parametrize("design,checkpoint", checkpoint_cases())
def test_main_checkpoint_move_passes_detector(design, checkpoint):
    _, moves = board_from_san_line(design["line"])
    assert checkpoint["ply"] < len(moves)
    assert checkpoint["ply"] >= 15
    assert checkpoint["pattern"] in design["target_patterns"]

    board = chess.Board()
    for mv in moves[: checkpoint["ply"]]:
        board.push(mv)
    student = chess.WHITE if design["side"] == "white" else chess.BLACK
    assert board.turn == student
    assert DETECTORS[checkpoint["pattern"]](board, moves[checkpoint["ply"]])


@pytest.mark.parametrize("design", MAIN_DESIGNS, ids=lambda d: f"{d['pattern']}-main")
def test_main_targets_are_cumulative_and_known(design):
    assert design["pattern"] in design["target_patterns"]
    for pattern in design["target_patterns"]:
        assert pattern in DETECTORS


# ── Negative cases ────────────────────────────────────────────────
@pytest.mark.parametrize("pattern", sorted(DETECTORS))
def test_quiet_opening_move_is_not_a_pattern(pattern):
    board = chess.Board()
    move = board.parse_san("e4")
    assert not DETECTORS[pattern](board, move)


@pytest.mark.parametrize("pattern", sorted(DETECTORS))
def test_illegal_move_is_rejected(pattern):
    board = chess.Board()
    illegal = chess.Move.from_uci("e2e5")
    assert not DETECTORS[pattern](board, illegal)


# ── is_move_safe basics ───────────────────────────────────────────
def test_hanging_piece_is_unsafe():
    # White queen on d5 attacked by the c6 pawn, undefended.
    board = chess.Board("4k3/8/2p5/3Q4/8/8/8/4K3 b - - 0 1")
    assert not is_move_safe(board, chess.D5)


def test_defended_piece_attacked_by_heavier_is_safe():
    # White knight on d5 defended by the e4 pawn; only the rook attacks it.
    board = chess.Board("3rk3/8/8/3N4/4P3/8/8/4K3 b - - 0 1")
    assert is_move_safe(board, chess.D5)


# ── Data file consistency ─────────────────────────────────────────
def test_emitted_json_matches_designs():
    rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    practice = [r for r in rows if r.get("game_type", "practice") == "practice"]
    mains = [r for r in rows if r.get("game_type") == "main"]
    assert len(practice) == len(PRACTICE_DESIGNS)
    assert len(mains) == len(MAIN_DESIGNS)
    for row in practice:
        assert row["setup_fen"] == chess.STARTING_FEN
        assert row["pattern_fen"]
        assert row["best_move"]
    for row in mains:
        assert row["game_number"] == 6
        assert row["checkpoints"]
        assert row["target_patterns"]
