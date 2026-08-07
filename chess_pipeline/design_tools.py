"""Search tooling for designing scripted pattern games.

Given a base opening line (real theory, SAN), search plausible quiet
continuations for both sides until a position appears where the side to
move has a detector-positive pattern move. Reports candidate lines
ranked by uniqueness (exactly one winning pattern move is best) and
shortness.

Usage (as a library):
    from chess_pipeline.design_tools import find_pattern_setups
    results = find_pattern_setups("1. e4 e5 2. Nf3 Nc6", "fork",
                                  student="white", max_extra_plies=4)
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import chess
import chess.pgn

from chess_pipeline.pattern_detectors import (
    DETECTORS,
    PIECE_VALUES,
    is_move_safe,
    piece_value,
)


def board_from_san_line(san_line: str) -> tuple[chess.Board, list[chess.Move]]:
    game = chess.pgn.read_game(io.StringIO(san_line))
    if game is None or game.errors:
        raise ValueError(f"bad SAN line: {san_line!r} ({game.errors if game else 'unparsable'})")
    board = chess.Board()
    moves = list(game.mainline_moves())
    for mv in moves:
        board.push(mv)
    return board, moves


def line_to_san(moves: list[chess.Move]) -> str:
    board = chess.Board()
    out = []
    for mv in moves:
        if board.turn == chess.WHITE:
            out.append(f"{board.fullmove_number}.")
        out.append(board.san(mv))
        board.push(mv)
    return " ".join(out)


def plausible_quiet_moves(board: chess.Board, allow_captures: bool = False,
                          limit: int = 10) -> list[chess.Move]:
    """Natural-looking filler moves: no hanging the mover, no checks,
    captures only if allowed, no king walks (castling ok), no early
    queen sorties beyond rank 4."""
    scored: list[tuple[int, chess.Move]] = []
    for mv in board.legal_moves:
        piece = board.piece_at(mv.from_square)
        if piece.piece_type == chess.KING and not board.is_castling(mv):
            continue
        if board.is_capture(mv) and not allow_captures:
            continue
        after = board.copy()
        after.push(mv)
        if after.is_check():
            continue
        if not is_move_safe(after, mv.to_square):
            continue
        # don't leave a previously-safe friendly piece newly hanging
        if _hangs_other_piece(board, after, mv):
            continue
        score = 0
        if board.is_castling(mv):
            score += 6
        if piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            score += 3
        if piece.piece_type == chess.PAWN:
            score += 1
        if piece.piece_type == chess.QUEEN:
            rank = chess.square_rank(mv.to_square)
            if (board.turn == chess.WHITE and rank > 3) or (
                board.turn == chess.BLACK and rank < 4
            ):
                continue
        scored.append((score, mv))
    scored.sort(key=lambda t: -t[0])
    return [mv for _, mv in scored[:limit]]


def _hangs_other_piece(before: chess.Board, after: chess.Board,
                       mv: chess.Move) -> bool:
    """True if mv leaves some OTHER friendly piece (value >= 3) en prise
    that was safe before the move."""
    color = before.turn
    for sq in chess.SQUARES:
        if sq == mv.to_square:
            continue
        piece = after.piece_at(sq)
        if piece is None or piece.color != color or piece_value(piece) < 3:
            continue
        if before.piece_at(sq) != piece:
            continue
        if not is_move_safe(after, sq) and is_move_safe(before, sq):
            return True
    return False


@dataclass
class Setup:
    extra_moves: list[chess.Move]
    pattern_move: chess.Move
    pattern_san: str
    hit_count: int           # how many moves in final position trigger detector
    full_line_san: str
    final_fen: str
    plies: int


def pattern_hits(board: chess.Board, pattern: str) -> list[chess.Move]:
    detector = DETECTORS[pattern]
    return [mv for mv in board.legal_moves if detector(board, mv)]


def find_pattern_setups(base_line_san: str, pattern: str, student: str,
                        max_extra_plies: int = 4, beam: int = 8,
                        allow_captures: bool = False,
                        max_results: int = 40) -> list[Setup]:
    base_board, base_moves = board_from_san_line(base_line_san)
    student_color = chess.WHITE if student == "white" else chess.BLACK
    results: list[Setup] = []
    seen_fens: set[str] = set()

    def visit(board: chess.Board, extra: list[chess.Move]):
        if len(results) >= max_results:
            return
        if board.turn == student_color:
            hits = pattern_hits(board, pattern)
            if hits:
                all_moves = base_moves + extra
                if len(all_moves) >= 15:
                    key = " ".join(board.fen().split()[:4])
                    if key not in seen_fens:
                        seen_fens.add(key)
                        for hit in hits[:1]:
                            results.append(Setup(
                                extra_moves=list(extra),
                                pattern_move=hit,
                                pattern_san=board.san(hit),
                                hit_count=len(hits),
                                full_line_san=line_to_san(all_moves),
                                final_fen=board.fen(),
                                plies=len(all_moves),
                            ))
                    return  # game ends at a recordable pattern moment
                # pattern available too early: keep searching other branches
        if len(extra) >= max_extra_plies:
            return
        for mv in plausible_quiet_moves(board, allow_captures=allow_captures,
                                        limit=beam):
            board.push(mv)
            visit(board, extra + [mv])
            board.pop()

    visit(base_board, [])
    results.sort(key=lambda s: (s.hit_count != 1, s.plies))
    return results


def describe(setups: list[Setup], top: int = 10) -> str:
    lines = []
    for s in setups[:top]:
        lines.append(
            f"plies={s.plies} hits={s.hit_count} move={s.pattern_san}\n"
            f"  line: {s.full_line_san}\n"
            f"  fen:  {s.final_fen}"
        )
    return "\n".join(lines) if lines else "(no setups found)"
