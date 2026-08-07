"""Verify scripted-game data (format v2) against quality rules.

Practice games (game_number 1-5):
  1. setup_fen is the standard start position
  2. pgn is fully legal from the standard start
  3. >= MIN_INTRO_PLIES scripted plies before the student's pattern move
  4. position after the pgn == pattern_fen (first 4 FEN fields)
  5. side-to-move in pattern_fen matches `side`
  6. best_move is legal and passes the pattern's detector
  7. within a level: openings differ (first DISTINCT_PREFIX_PLIES plies),
     pattern positions differ, and no two games share the same
     (mover piece type, destination square) for the pattern move
  8. within a level: at least MIN_MOVER_VARIETY distinct mover piece types

Main games (game_type == "main"):
  1. pgn is fully legal from the standard start
  2. every checkpoint ply is a student-side move whose mainline move
     passes the checkpoint pattern's detector
  3. checkpoint patterns are a subset of target_patterns

Usage:  python -m chess_pipeline.verify_games [path/to/games.json]
Exit 0 = all pass.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import chess
import chess.pgn
import io

from chess_pipeline.pattern_detectors import DETECTORS, PIECE_VALUES

STANDARD_START = chess.STARTING_FEN
MIN_INTRO_PLIES = 15
DISTINCT_PREFIX_PLIES = 6
MIN_MOVER_VARIETY = 2

DEFAULT_DATA = Path(__file__).resolve().parent.parent / "scripts" / "scripted_games_data.json"


def norm_fen(fen: str) -> str:
    return " ".join(fen.split(" ")[:4])


def parse_pgn_moves(pgn: str) -> list[chess.Move] | None:
    """Parse a movetext-only PGN from the standard start. None on error."""
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        return None
    if game.errors:
        return None
    return list(game.mainline_moves())


class Failures:
    def __init__(self):
        self.items: list[str] = []

    def add(self, label: str, msg: str):
        self.items.append(f"[FAIL] {label}: {msg}")


def verify_practice(games: list[dict], fails: Failures) -> None:
    by_pattern: dict[str, list[dict]] = {}
    for g in games:
        by_pattern.setdefault(g["pattern"], []).append(g)

    for pattern, group in by_pattern.items():
        detector = DETECTORS.get(pattern)
        if detector is None:
            fails.add(pattern, f"no detector for pattern '{pattern}'")
            continue

        seen_prefixes: dict[tuple, str] = {}
        seen_fens: dict[str, str] = {}
        seen_signatures: dict[tuple, str] = {}
        mover_types: set[int] = set()

        for g in sorted(group, key=lambda x: x["game_number"]):
            label = f"{pattern} #{g['game_number']} — {g.get('title', '?')}"

            if norm_fen(g.get("setup_fen", "")) != norm_fen(STANDARD_START):
                fails.add(label, "setup_fen is not the standard start position")
                continue

            moves = parse_pgn_moves(g["pgn"])
            if not moves:
                fails.add(label, "pgn failed to parse from the standard start")
                continue
            if len(moves) < MIN_INTRO_PLIES:
                fails.add(label, f"only {len(moves)} scripted plies (need >= {MIN_INTRO_PLIES})")

            board = chess.Board()
            legal = True
            for mv in moves:
                if mv not in board.legal_moves:
                    fails.add(label, f"illegal scripted move {mv.uci()} at ply {board.ply()}")
                    legal = False
                    break
                board.push(mv)
            if not legal:
                continue

            if norm_fen(board.fen()) != norm_fen(g["pattern_fen"]):
                fails.add(label, "pattern_fen does not match position after pgn")
                continue

            expected_turn = chess.WHITE if g["side"] == "white" else chess.BLACK
            if board.turn != expected_turn:
                fails.add(label, f"side-to-move is not the student ({g['side']})")
                continue

            try:
                best = chess.Move.from_uci(g["best_move"])
            except ValueError:
                fails.add(label, f"best_move '{g['best_move']}' is not valid UCI")
                continue
            if best not in board.legal_moves:
                fails.add(label, f"best_move {g['best_move']} is illegal in pattern position")
                continue

            if not detector(board, best):
                fails.add(label, f"best_move {g['best_move']} does not pass the {pattern} detector")
                continue

            # distinctness bookkeeping
            prefix = tuple(m.uci() for m in moves[:DISTINCT_PREFIX_PLIES])
            if prefix in seen_prefixes:
                fails.add(label, f"opening (first {DISTINCT_PREFIX_PLIES} plies) duplicates {seen_prefixes[prefix]}")
            seen_prefixes[prefix] = label

            nf = norm_fen(g["pattern_fen"])
            if nf in seen_fens:
                fails.add(label, f"pattern_fen duplicates {seen_fens[nf]}")
            seen_fens[nf] = label

            mover = board.piece_at(best.from_square)
            sig = (mover.piece_type, best.to_square)
            if sig in seen_signatures:
                fails.add(label, f"pattern move ({mover.symbol()} to {chess.square_name(best.to_square)}) duplicates {seen_signatures[sig]}")
            seen_signatures[sig] = label
            mover_types.add(mover.piece_type)

        if len(group) > 1 and len(mover_types) < MIN_MOVER_VARIETY:
            fails.add(pattern, f"all pattern moves use the same piece type (need >= {MIN_MOVER_VARIETY} types)")


def verify_main(games: list[dict], fails: Failures) -> None:
    for g in games:
        label = f"{g['pattern']} MAIN — {g.get('title', '?')}"

        moves = parse_pgn_moves(g["pgn"])
        if not moves:
            fails.add(label, "pgn failed to parse from the standard start")
            continue

        board = chess.Board()
        positions: list[chess.Board] = []
        legal = True
        for mv in moves:
            if mv not in board.legal_moves:
                fails.add(label, f"illegal mainline move {mv.uci()} at ply {board.ply()}")
                legal = False
                break
            positions.append(board.copy())
            board.push(mv)
        if not legal:
            continue

        student_color = chess.WHITE if g["side"] == "white" else chess.BLACK
        targets = set(g.get("target_patterns", []))

        for cp in g.get("checkpoints", []):
            ply, pat = cp["ply"], cp["pattern"]
            cp_label = f"{label} checkpoint ply {ply} ({pat})"
            if pat not in targets:
                fails.add(cp_label, "checkpoint pattern not in target_patterns")
            if ply >= len(moves):
                fails.add(cp_label, "ply beyond end of mainline")
                continue
            pos = positions[ply]
            if pos.turn != student_color:
                fails.add(cp_label, "checkpoint ply is not a student move")
                continue
            if ply < MIN_INTRO_PLIES:
                fails.add(cp_label, f"first pattern appears before ply {MIN_INTRO_PLIES}")
            detector = DETECTORS.get(pat)
            if detector is None:
                fails.add(cp_label, f"no detector for '{pat}'")
                continue
            if not detector(pos, moves[ply]):
                fails.add(cp_label, f"mainline move {moves[ply].uci()} does not pass the {pat} detector")

        if not g.get("checkpoints"):
            fails.add(label, "main game has no pattern checkpoints")


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_DATA
    games = json.loads(path.read_text(encoding="utf-8"))

    practice = [g for g in games if g.get("game_type", "practice") == "practice"]
    mains = [g for g in games if g.get("game_type") == "main"]

    fails = Failures()
    verify_practice(practice, fails)
    verify_main(mains, fails)

    for line in fails.items:
        print(line)
    total = len(practice) + len(mains)
    print(f"\n{total - len(set(f.split(':')[0] for f in fails.items))}/{total} games clean "
          f"({len(fails.items)} failure(s)) — {len(practice)} practice, {len(mains)} main")
    return 1 if fails.items else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
