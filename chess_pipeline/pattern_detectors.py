"""Chess tactical-pattern detectors.

Pure functions over python-chess boards. Each detector answers:
"does `move`, played from `board`, create the named pattern soundly?"

Sound = the moved piece cannot be immediately captured at a profit
(checked against *legal* replies, so pins and check obligations are
respected automatically).

Reusable across projects: no game-format or app-specific imports.
"""

from __future__ import annotations

import chess

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}

SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)


def piece_value(piece: chess.Piece | None) -> int:
    return PIECE_VALUES[piece.piece_type] if piece else 0


def is_move_safe(board_after: chess.Board, square: chess.Square) -> bool:
    """True if the piece on `square` cannot be captured at a profit by any
    legal reply. Equal-value trades by an undefended capture also count
    as unsafe (the tactic would just be a swap, not a pattern win)."""
    mover = board_after.piece_at(square)
    if mover is None:
        return True
    mover_val = piece_value(mover)
    defenders = board_after.attackers(mover.color, square)

    for reply in board_after.legal_moves:
        if reply.to_square != square or not board_after.is_capture(reply):
            continue
        capturer = board_after.piece_at(reply.from_square)
        capturer_val = piece_value(capturer)
        if capturer_val < mover_val:
            return False  # cheaper piece takes: always a loss
        if not defenders:
            return False  # undefended: any capture loses the piece
    return True


def _ray_squares(from_sq: chess.Square, direction: tuple[int, int]):
    """Yield squares stepping (df, dr) from from_sq until the board edge."""
    f, r = chess.square_file(from_sq), chess.square_rank(from_sq)
    df, dr = direction
    while True:
        f, r = f + df, r + dr
        if not (0 <= f <= 7 and 0 <= r <= 7):
            return
        yield chess.square(f, r)


def _slider_directions(piece_type: chess.PieceType) -> list[tuple[int, int]]:
    diag = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    orth = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    if piece_type == chess.BISHOP:
        return diag
    if piece_type == chess.ROOK:
        return orth
    if piece_type == chess.QUEEN:
        return diag + orth
    return []


def _line_pairs(board: chess.Board, slider_sq: chess.Square):
    """For each ray of the slider on slider_sq, yield (front, behind):
    the first two occupied squares along the ray."""
    slider = board.piece_at(slider_sq)
    if slider is None:
        return
    for direction in _slider_directions(slider.piece_type):
        front = None
        for sq in _ray_squares(slider_sq, direction):
            if board.piece_at(sq) is None:
                continue
            if front is None:
                front = sq
            else:
                yield front, sq
                break


def detect_fork(board: chess.Board, move: chess.Move) -> bool:
    """Moved piece attacks >=2 enemy targets at once, each of which is
    the king (check), worth more than the mover, or undefended."""
    if move not in board.legal_moves:
        return False
    after = board.copy()
    after.push(move)
    sq = move.to_square
    mover = after.piece_at(sq)
    if mover is None or not is_move_safe(after, sq):
        return False

    mover_val = piece_value(mover)
    enemy = not mover.color
    targets = 0
    for t in after.attacks(sq):
        victim = after.piece_at(t)
        if victim is None or victim.color != enemy:
            continue
        if victim.piece_type == chess.KING:
            targets += 1
        elif piece_value(victim) > mover_val:
            targets += 1
        elif piece_value(victim) >= 3 and not after.attackers(enemy, t):
            targets += 1
    return targets >= 2


def detect_pin(board: chess.Board, move: chess.Move) -> bool:
    """Move places a slider so an enemy piece is stuck in front of its
    king (absolute pin) or in front of a heavier piece (Q/R behind)."""
    if move not in board.legal_moves:
        return False
    after = board.copy()
    after.push(move)
    sq = move.to_square
    mover = after.piece_at(sq)
    if mover is None or mover.piece_type not in SLIDERS:
        return False
    if not is_move_safe(after, sq):
        return False

    enemy = not mover.color
    for front, behind in _line_pairs(after, sq):
        p1, p2 = after.piece_at(front), after.piece_at(behind)
        if p1.color != enemy or p2.color != enemy:
            continue
        if p1.piece_type == chess.KING:
            continue  # that ordering is a skewer, not a pin
        if piece_value(p1) < 3:
            continue  # pinned pawns are not worth teaching as a pin
        # Fake pin: the "pinned" piece can simply capture the pinner
        # (e.g. bishop "pinning" a bishop on the same diagonal).
        if sq in after.attacks(front):
            pinner_defended = bool(after.attackers(mover.color, sq))
            if not pinner_defended or piece_value(p1) <= piece_value(mover):
                continue
        absolute = p2.piece_type == chess.KING
        relative = piece_value(p2) >= 5 and piece_value(p2) > piece_value(p1)
        if absolute or relative:
            # The pin must bite: pinned piece is attacked by the slider
            # and cannot profitably take it (slider already checked safe),
            # and the pinned piece is worth winning or paralysed.
            if absolute and after.is_pinned(enemy, front):
                return True
            if relative:
                return True
    return False


def detect_skewer(board: chess.Board, move: chess.Move) -> bool:
    """Move attacks a high-value enemy piece (K or Q) in line with a
    lesser piece behind it: when the front piece moves, the back one falls."""
    if move not in board.legal_moves:
        return False
    after = board.copy()
    after.push(move)
    sq = move.to_square
    mover = after.piece_at(sq)
    if mover is None or mover.piece_type not in SLIDERS:
        return False
    if not is_move_safe(after, sq):
        return False

    enemy = not mover.color
    mover_val = piece_value(mover)
    for front, behind in _line_pairs(after, sq):
        p1, p2 = after.piece_at(front), after.piece_at(behind)
        if p1.color != enemy or p2.color != enemy:
            continue
        front_forced = p1.piece_type == chess.KING or (
            p1.piece_type == chess.QUEEN and mover_val < piece_value(p1)
        )
        if not front_forced:
            continue
        if not (3 <= piece_value(p2) < piece_value(p1)):
            continue
        # The loot must actually be winnable once the front piece flees:
        # undefended (not counting the fleeing piece), or worth more
        # than the attacker.
        defenders = after.attackers(enemy, behind) & ~chess.BB_SQUARES[front]
        if not defenders or piece_value(p2) > mover_val:
            return True
    return False


def detect_discovered_attack(board: chess.Board, move: chess.Move) -> bool:
    """Moving one piece uncovers a friendly slider's attack on the enemy
    king (discovered check) or a heavy piece, while the moved piece itself
    also does something (captures, checks, or attacks material)."""
    if move not in board.legal_moves:
        return False
    color = board.turn
    enemy = not color
    after = board.copy()
    after.push(move)

    if not is_move_safe(after, move.to_square):
        return False

    best_discovered = 0  # 100 = king, 9 = queen, 5 = rook
    for slider_sq in (
        list(after.pieces(chess.BISHOP, color))
        + list(after.pieces(chess.ROOK, color))
        + list(after.pieces(chess.QUEEN, color))
    ):
        if slider_sq == move.to_square:
            continue  # the mover itself is not the discovered piece
        # The vacated square must sit on the line between slider and target.
        for target in after.attacks(slider_sq):
            victim = after.piece_at(target)
            if victim is None or victim.color != enemy:
                continue
            if victim.piece_type != chess.KING and piece_value(victim) < 5:
                continue
            if move.from_square not in chess.SquareSet.between(slider_sq, target):
                continue
            if target in board.attacks(slider_sq):
                continue  # was already attacked: nothing was discovered
            # Refutable: the attacked piece just captures the slider.
            if slider_sq in after.attacks(target) and not after.attackers(
                color, slider_sq
            ):
                continue
            best_discovered = max(best_discovered, piece_value(victim))
        if best_discovered >= 9:
            break
    if not best_discovered:
        return False

    # A revealed attack on king or queen forces a response by itself.
    if best_discovered >= 9:
        return True

    # A revealed attack on a rook needs the mover to add its own threat
    # (a true double attack), or the rook simply steps away.
    if board.is_capture(move):
        return True
    if after.is_check():
        return True
    mover_val = piece_value(after.piece_at(move.to_square))
    for t in after.attacks(move.to_square):
        victim = after.piece_at(t)
        if victim and victim.color == enemy and piece_value(victim) > mover_val:
            return True
        if victim and victim.color == enemy and piece_value(victim) >= 3 \
                and not after.attackers(enemy, t):
            return True
    return False


def detect_double_check(board: chess.Board, move: chess.Move) -> bool:
    """Two pieces give check simultaneously."""
    if move not in board.legal_moves:
        return False
    after = board.copy()
    after.push(move)
    return len(after.checkers()) == 2


def detect_back_rank_mate(board: chess.Board, move: chess.Move) -> bool:
    """Checkmate delivered by a heavy piece along the enemy back rank,
    the king walled in on that rank."""
    if move not in board.legal_moves:
        return False
    after = board.copy()
    after.push(move)
    if not after.is_checkmate():
        return False

    enemy = after.turn  # side that just got mated
    king_sq = after.king(enemy)
    back_rank = 7 if enemy == chess.BLACK else 0
    if chess.square_rank(king_sq) != back_rank:
        return False

    for checker_sq in after.checkers():
        checker = after.piece_at(checker_sq)
        if checker.piece_type in (chess.ROOK, chess.QUEEN) and (
            chess.square_rank(checker_sq) == back_rank
        ):
            return True
    return False


DETECTORS = {
    "fork": detect_fork,
    "pin": detect_pin,
    "skewer": detect_skewer,
    "discovered_attack": detect_discovered_attack,
    "double_check": detect_double_check,
    "back_rank_mate": detect_back_rank_mate,
}
