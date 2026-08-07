"""Find verified fork examples for each sub-type.

Uses find_pattern_setups to guarantee all lines are legal.
Run: python -m chess_pipeline.gen_fork_examples
Results are printed as they are found.
"""

from __future__ import annotations

import chess

from chess_pipeline.design_tools import board_from_san_line, find_pattern_setups


def classify_fork(board: chess.Board, move: chess.Move) -> str:
    mover = board.piece_at(move.from_square)
    if not mover:
        return "unknown"
    after = board.copy()
    after.push(move)
    dest = move.to_square
    color = mover.color
    attacked = []
    for sq in chess.SQUARES:
        if sq == dest:
            continue
        target = after.piece_at(sq)
        if target and target.color != color and after.is_attacked_by(color, sq):
            attacked.append((sq, target))
    types = {t.piece_type for _, t in attacked}
    dr = chess.square_rank(dest)
    df = chess.square_file(dest)
    pt = mover.piece_type
    if pt == chess.KNIGHT:
        if chess.KING in types and chess.QUEEN in types:
            return "knight_king_queen"
        if chess.KING in types and chess.ROOK in types:
            return "knight_king_rook"
        if chess.QUEEN in types and chess.ROOK in types:
            return "knight_queen_rook"
        if dr in (0, 7) or df in (0, 7):
            return "knight_edge"
        if dr in (3, 4) and df in (3, 4):
            return "knight_center"
        if all(t.piece_type in (chess.KNIGHT, chess.BISHOP) for _, t in attacked):
            return "knight_double_minor"
        return "knight_other"
    if pt == chess.PAWN:
        if after.is_check():
            return "pawn_king_queen" if chess.QUEEN in types else "pawn_check"
        if all(t.piece_type != chess.PAWN for _, t in attacked):
            return "pawn_two_pieces"
        return "pawn_break_fork"
    if pt == chess.QUEEN:
        if after.is_check():
            return "queen_check_fork"
        sq_ranks = [chess.square_rank(sq) for sq, _ in attacked]
        if len(set(sq_ranks)) == 1 and sq_ranks[0] in (0, 7):
            return "queen_back_rank"
        return "queen_fork"
    if pt == chess.ROOK:
        sq_ranks = [chess.square_rank(sq) for sq, _ in attacked]
        sq_files = [chess.square_file(sq) for sq, _ in attacked]
        if all(r == dr for r in sq_ranks):
            return "rook_horizontal"
        if all(f == df for f in sq_files):
            return "rook_vertical"
        return "rook_fork"
    return "other"


# (base_line, side, max_extra, label, target_sub_types)
TASKS = [
    # knight_king_queen — Scotch Gambit Nf6+
    (
        "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4 Bc5 5. c3 Nf6 "
        "6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. bxc3 d5 "
        "10. Bxd5 Qxd5 11. Re1 Be6 12. Ng5 Bg4",
        "white", 5, "kq-Scotch",
    ),
    # knight_king_queen — Scandinavian
    (
        "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 "
        "6. h3 Bh5 7. g4 Bg6 8. Bd2 e6 9. d5 exd5",
        "white", 5, "kq-Scandinavian",
    ),
    # knight_king_rook — Italian Two Knights (Nexc7+)
    (
        "1. e4 e5 2. Bc4 Nc6 3. Nf3 Nf6 4. d3 d6 5. Nc3 Be7 "
        "6. O-O Be6 7. Bxe6 fxe6 8. Ng5 d5 9. exd5 exd5",
        "white", 5, "kr-Italian",
    ),
    # knight_king_rook — Berlin
    (
        "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 "
        "6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8 "
        "10. Re1 b6 11. Bf4 Be7",
        "white", 5, "kr-Berlin",
    ),
    # knight_queen_rook — Scandinavian Nxc7
    (
        "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 "
        "6. h3 Bh5 7. g4 Bg6 8. Bd2 e6 9. d5 exd5 10. Nb5 Qa6 "
        "11. Bf4 Be7 12. Rc1 O-O",
        "white", 4, "qr-Scandinavian",
    ),
    # knight_queen_rook — Italian Nf7
    (
        "1. e4 e5 2. Bc4 Nc6 3. Nf3 Nf6 4. d3 d6 5. Nc3 Be7 "
        "6. O-O Be6 7. Bxe6 fxe6 8. Ng5 d5 9. exd5 exd5",
        "white", 4, "qr-Italian",
    ),
    # knight_double_minor — Four Knights Ne3
    (
        "1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bb4 5. O-O O-O "
        "6. d3 d6 7. Bg5 Bxc3 8. bxc3 Qe7 9. Bh4 Bd7 10. Ng5 Ng4",
        "black", 4, "dm-FourKnights",
    ),
    # knight_double_minor — KID Nxe4
    (
        "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O "
        "6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. b4 Nh5 10. Re1 f5 "
        "11. Nh4 Nf6 12. Bg5",
        "black", 4, "dm-KID",
    ),
    # knight_edge — QGD
    (
        "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O "
        "6. Nf3 h6 7. Bh4 b6 8. cxd5 exd5 9. Bd3 Bb7 10. O-O "
        "Nbd7 11. Qc2 c5 12. dxc5 bxc5 13. Rac1 Rc8 14. Rfe1 Nd6",
        "white", 5, "edge-QGD",
    ),
    # knight_edge — Ruy Lopez
    (
        "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 "
        "6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 "
        "11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 "
        "15. a4 c5 16. d5 c4 17. b4 cxb3 18. Bxb3 Nc5 19. Bc2",
        "black", 5, "edge-RuyLopez",
    ),
    # knight_center — Sicilian Najdorf
    (
        "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 "
        "6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O "
        "Nbd7 11. g4 b5 12. g5 Nh5 13. Nd5 Bxd5 14. exd5 Nb6 "
        "15. Bxb6 Qxb6",
        "white", 5, "center-Najdorf",
    ),
    # knight_center — Queen's Indian
    (
        "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb7 5. Bg2 Be7 "
        "6. O-O O-O 7. Nc3 Ne4 8. Qc2 Nxc3 9. Qxc3 c5 "
        "10. Rd1 cxd4 11. Nxd4 Nc6 12. Nxc6 dxc6 13. b3 "
        "Qxd1+ 14. Rxd1 Rfd8 15. Rxd8+ Rxd8",
        "black", 5, "center-QIndian",
    ),
    # pawn_two_pieces — Italian
    (
        "1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7 4. d3 Nf6 5. O-O O-O "
        "6. Re1 d6 7. c3 Be6 8. Bb3 h6 9. d4 exd4 10. cxd4 Re8",
        "white", 4, "pawn2-Italian",
    ),
    # pawn_two_pieces — Scheveningen
    (
        "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 "
        "6. Be2 Qc7 7. O-O Nc6 8. Be3 Be7 9. f4 d6 10. Kh1 "
        "Nxd4 11. Bxd4 e5 12. fxe5 dxe5 13. Be3 O-O 14. Nd5 "
        "Nxd5 15. exd5",
        "white", 4, "pawn2-Schev",
    ),
    # pawn_king_queen — French Advance
    (
        "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 "
        "6. Bd3 cxd4 7. cxd4 Bd7 8. O-O Nge7 9. Na3 Nf5 "
        "10. Nc2 h6 11. b4 Rc8 12. a3 g5 13. Bb2 g4 "
        "14. Ne1 Nce7 15. Nd3 Ng6",
        "white", 5, "pawnKQ-French",
    ),
    # pawn_break_fork — KIA
    (
        "1. e4 c5 2. Nf3 e6 3. d3 Nc6 4. g3 g6 5. Bg2 Bg7 "
        "6. O-O Nge7 7. Nbd2 O-O 8. Re1 d5 9. exd5 exd5 "
        "10. Nb3 b6 11. c3 Ba6 12. d4 cxd4 13. cxd4 Qd7 "
        "14. Bf4 Rac8 15. Ne5 Nxe5 16. Bxe5 Bxe2 17. Rxe2 "
        "Nc6 18. Bxg7 Kxg7 19. Qd2 Qe6 20. Re3 Rfe8",
        "white", 4, "pawnBreak-KIA",
    ),
    # queen_back_rank — Catalan
    (
        "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. g3 Be7 5. Bg2 O-O "
        "6. O-O c6 7. Qc2 Nbd7 8. Rd1 b6 9. cxd5 exd5 "
        "10. Bf4 Ba6 11. Nc3 Rc8 12. Qb3 Re8 13. Ne5 Nxe5 "
        "14. Bxe5 Bd6 15. Bxd6 Qxd6 16. e3 c5 17. dxc5 bxc5 "
        "18. Rdc1 d4 19. Nd1 dxe3 20. fxe3 Qxe3+ 21. Kh1",
        "black", 4, "qbr-Catalan",
    ),
    # queen_check_fork — Caro-Kann
    (
        "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 "
        "6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 "
        "10. Qxd3 e6 11. Bd2 Ngf6 12. O-O Be7",
        "white", 4, "qchk-CaroKann",
    ),
    # queen_check_fork — Philidor
    (
        "1. e4 e5 2. Nf3 d6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Be7 "
        "6. Bc4 O-O 7. O-O c6 8. Bb3 d5 9. exd5 cxd5 10. Nxd5 "
        "Nxd5 11. Bxd5 Nc6 12. Nxc6 bxc6 13. Bxc6 Rb8 "
        "14. Qd3 Bg4 15. f3 Bd7 16. c4",
        "white", 5, "qchk-Philidor",
    ),
    # queen_sacrifice_fork — Dragon (after Rxd8 position)
    (
        "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 "
        "6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. O-O-O d5 "
        "10. exd5 Nxd5 11. Nxc6 bxc6 12. Nxd5 cxd5 13. Qxd5 "
        "Be6 14. Qxa8 Qxa8 15. Bc4 Qd8 16. Bxe6 fxe6 "
        "17. Rxd8 Rxd8",
        "white", 5, "qsac-Dragon",
    ),
    # rook_horizontal — QGA
    (
        "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 "
        "6. O-O a6 7. Qe2 b5 8. Bd3 Bb7 9. Nc3 cxd4 10. exd4 "
        "Be7 11. Bg5 O-O 12. Rfe1 Nbd7 13. Ne5 Nxe5 14. dxe5 "
        "Nd5 15. Bxe7 Qxe7 16. Nxd5 exd5",
        "white", 5, "rook-horiz-QGA",
    ),
    # rook_vertical — Grunfeld
    (
        "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 "
        "Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Rb1 O-O 9. Be2 cxd4 "
        "10. cxd4 Qa5+ 11. Bd2 Qxa2 12. O-O Bg4 13. Rxb7 "
        "Bxf3 14. Bxf3 Nc6 15. d5 Nd4 16. Be2",
        "white", 5, "rook-vert-Grunfeld",
    ),
    # rook_vertical — Exchange Slav
    (
        "1. d4 d5 2. c4 c6 3. Nc3 Nf6 4. Nf3 e6 5. e3 Nbd7 "
        "6. Bd3 dxc4 7. Bxc4 b5 8. Bd3 a6 9. O-O c5 10. a3 "
        "Bb7 11. dxc5 Bxc5 12. b4 Bd6 13. Bb2 O-O 14. Qc2 "
        "Qe7 15. Rfd1 Rfd8",
        "white", 5, "rook-vert-Slav",
    ),
]


def main() -> None:
    collected: dict[str, list[tuple[str, str, int]]] = {}

    for base, side, max_extra, label in TASKS:
        print(f"  {label} ...", flush=True)
        try:
            results = find_pattern_setups(
                base, "fork", side,
                max_extra_plies=max_extra,
                beam=4,
                max_results=15,
                allow_captures=False,
            )
        except Exception as exc:
            print(f"    ERROR: {exc}")
            continue

        for r in results:
            try:
                board, _ = board_from_san_line(r.full_line_san)
                move = board.parse_san(r.pattern_san)
                sub = classify_fork(board, move)
                if sub not in collected:
                    collected[sub] = []
                if len(collected[sub]) < 4:
                    entry = (r.full_line_san, r.pattern_san, r.plies)
                    if entry not in collected[sub]:
                        collected[sub].append(entry)
                        print(f"    [{sub}] {r.pattern_san} ply={r.plies}")
                        print(f"      line=\"{r.full_line_san}\"")
            except Exception:
                continue

    print("\n=== SUMMARY ===")
    for sub in sorted(collected.keys()):
        print(f"  {sub}: {len(collected[sub])} examples")


if __name__ == "__main__":
    main()
