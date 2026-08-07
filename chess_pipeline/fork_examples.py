"""Extended fork-pattern practice designs for ChessQuest.

Covers every fork sub-type the curriculum requires:
  Knight: King+Queen, King+Rook, Queen+Rook, Double Minor, Edge, Center
  Pawn:   Two Pieces, King+Queen, Pawn-Break Fork
  Queen:  Back Rank, With Check, After Sacrifice
  Rook:   Horizontal, Vertical

Validate with: python -m chess_pipeline.check_fork_examples
"""

FORK_EXAMPLES = [

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — KING + QUEEN  (incl. family fork)
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=11, fork_type="knight_king_queen",
        side="white",
        title="The Family Fork",
        opening="Scandinavian Defence (3...Qa5)",
        line=(
            "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 "
            "6. h3 Bh5 7. g4 Bg6 8. Bd2 e6 9. d5 exd5 10. Nb5 Qa6"
        ),
        best_move_san="Nc7+",
        story=(
            "Black's queen moved to a6 to 'defend' c7 — but a queen "
            "on a6 doesn't actually guard c7! Your knight leaps to c7 "
            "with check, attacking the king on e8, the queen on a6, AND "
            "the rook on a8 all at once. That's the famous family fork!"
        ),
    ),

    dict(
        pattern="fork", game_number=12, fork_type="knight_king_queen",
        side="white",
        title="Queen Out of Position",
        opening="Centre Game",
        line=(
            "1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 5. Nc3 Bb4 "
            "6. Bd2 O-O 7. O-O-O Re8 8. Bc4 d6 9. Nf3 Be6 10. Bb3 "
            "Nd4 11. Nxd4 Bxb3 12. axb3 d5 13. exd5 Qxd5 14. Nb5 Qa5 "
            "15. Nd6 Re6 16. Nf5 Qb6 17. Qxb6 axb6 18. Nd4 Re8 "
            "19. Nb5 Rd8 20. Bg5 h6 21. Be3 Ng4 22. Nd6"
        ),
        best_move_san="Nxe8",
        story=(
            "The knight manoeuvre d6 ties Black's rook to the e8-square. "
            "After all the exchanges the queen is gone, but the knight "
            "captures the rook and forks king and rook in the same move!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — KING + ROOK
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=13, fork_type="knight_king_rook",
        side="white",
        title="Berlin Endgame Trick",
        opening="Ruy Lopez (Berlin Defence)",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 "
            "6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8 "
            "10. Re1 b6 11. Bf4 Bb7 12. Rad1 Rd8 13. Nd4 Nd6 "
            "14. exd6 cxd6 15. Ndb5 d5"
        ),
        best_move_san="Nc7+",
        story=(
            "The queens are gone but the knight is mightier than it looks. "
            "Black's king never castled; the a8-rook sits forgotten. One "
            "knight leap to c7 checks the king and skewers the rook — "
            "both can't be saved."
        ),
    ),

    dict(
        pattern="fork", game_number=14, fork_type="knight_king_rook",
        side="white",
        title="The Queenside Trap",
        opening="Scandinavian Defence (3...Qa5 extended)",
        line=(
            "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 c6 "
            "6. Bc4 Bf5 7. Bd2 e6 8. O-O Bb4 9. a3 Bxc3 10. Bxc3 "
            "Qc7 11. Re1 Nbd7 12. Bb3 O-O-O 13. a4 Kb8 14. a5 Nb8 "
            "15. Nd2 Ne4 16. Nxe4 Bxe4 17. f3 Bf5 18. Qd2 Nd7 "
            "19. Ba4 Nb6 20. axb6 axb6 21. Bb5"
        ),
        best_move_san="Nc7+",
        story=(
            "White has steadily pushed Black's queenside pieces back. "
            "The knight darts to c7 with check — the king on b8 must "
            "flee and the rook on a8 is trapped. One move wins the exchange!"
        ),
    ),

    dict(
        pattern="fork", game_number=15, fork_type="knight_king_rook",
        side="white",
        title="The f7 Skewer",
        opening="Two Knights Defence (delayed Ng5)",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 d6 5. O-O Be7 "
            "6. Nc3 Be6 7. Bxe6 fxe6 8. Ng5 Qd7 9. h3 Rf8 "
            "10. Nge4 Nxe4 11. Nxe4 d5 12. Ng3 O-O-O 13. Be3 g6 "
            "14. Qd2 h5 15. O-O-O h4 16. Nf1 Kb8 17. Bg5 Bg5?? "
            "18. Qxg5 Rde8 19. Nd2 Nd4 20. Nb3 Nxb3+ 21. axb3 Qe7 "
            "22. f4 exf4 23. Rxf4 Rxf4 24. Qxf4+ Ka8 25. Qf7"
        ),
        best_move_san="Qxe8+",
        story=(
            "The queen bursts through on f7, and now attacks the rook "
            "on e8 while leaving the king trapped. A single check wins "
            "the rook outright."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — QUEEN + ROOK
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=16, fork_type="knight_queen_rook",
        side="white",
        title="Fried Liver Revisited",
        opening="Italian Game (Two Knights)",
        line=(
            "1. e4 e5 2. Bc4 Nc6 3. Nf3 Nf6 4. d3 d6 5. Nc3 Be7 "
            "6. O-O Be6 7. Bxe6 fxe6 8. Ng5 d5 9. exd5 exd5"
        ),
        best_move_san="Nxf7",
        story=(
            "The knight sacrifices itself on f7! After landing there it "
            "attacks the queen on d8 AND the rook on h8 at the same "
            "time — Black cannot save both pieces."
        ),
    ),

    dict(
        pattern="fork", game_number=17, fork_type="knight_queen_rook",
        side="white",
        title="Fork Before the Castle",
        opening="King's Gambit Declined",
        line=(
            "1. e4 e5 2. f4 Bc5 3. Nf3 d6 4. Bc4 Nc6 5. Nc3 Nf6 "
            "6. d3 Bg4 7. h3 Bh5 8. g4 Bg6 9. f5 Bf7 10. Ng5 Bxc4 "
            "11. dxc4 Nd4 12. Ne2 Nxe2 13. Qxe2 h6 14. Nxf7 Rxf7?? "
            "15. Bg5 hxg5 16. Qc4 Qd7 17. O-O-O Ne8 18. h4 gxh4 "
            "19. Rxh4 g6 20. fxg6 Rxg6 21. Rdh1 Bg8 22. g5 Rf7 "
            "23. Rh7 Rxh7 24. Rxh7 Qxh7 25. Qxf7+ Kd8 26. Qxe8+ "
            "Kc7 27. g6 Qh1+ 28. Kd2 Qxg6 29. Qxg6 Kd8 30. Qxb6+ "
            "Kc8 31. Qc6+"
        ),
        best_move_san="Nd5",
        story=(
            "After all the fireworks, the knight hops to d5 — a square "
            "that hits both the black queen and the rook. When two heavy "
            "pieces are forked by a knight, one must be sacrificed."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — DOUBLE MINOR PIECE
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=18, fork_type="knight_double_minor",
        side="white",
        title="Two for the Price of One",
        opening="Nimzo-Indian Defence",
        line=(
            "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Nf3 d5 "
            "6. Bd3 c5 7. O-O dxc4 8. Bxc4 cxd4 9. exd4 b6 "
            "10. Bg5 Bb7 11. Re1 Bxc3 12. bxc3 Nbd7 13. Qd3 Qc7 "
            "14. Rac1 Rac8 15. Bd3 h6 16. Bh4 Rfe8 17. Ne5 Nxe5 "
            "18. dxe5 Nd5 19. Bxd8 Nxc3 20. Qh7+ Kf8 21. Bg5 Rxd8"
        ),
        best_move_san="Ne4",
        story=(
            "After the dust settles, the knight leaps to e4 and attacks "
            "two undefended minor pieces at the same time. Black can only "
            "save one — the other falls for free."
        ),
    ),

    dict(
        pattern="fork", game_number=19, fork_type="knight_double_minor",
        side="black",
        title="Scatter the Bishops",
        opening="English Opening (Symmetrical)",
        line=(
            "1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. e3 e6 "
            "6. Nge2 Nge7 7. O-O O-O 8. d3 d5 9. cxd5 exd5 "
            "10. Nf4 d4 11. exd4 cxd4 12. Nb5 Qd7 13. Re1 a6 "
            "14. Na3 Rd8 15. Nc2 Bxc3 16. bxc3 Nf5 17. Bf3 dxc3 "
            "18. Bxc6 Qxc6 19. Ne3 Nxe3 20. fxe3 Bg4 21. Qb3 "
            "Bxe2 22. Rxe2 Rd3 23. Qc2 Rad8 24. Re1 Qd5 "
            "25. Rf1 h5 26. Qb2 g5 27. h3 g4 28. hxg4 hxg4 "
            "29. Bf4 Re8"
        ),
        best_move_san="Nd4",
        story=(
            "Your knight jumps to d4, attacking both the bishop on f3 "
            "and the rook on e1 at once. White cannot defend both. "
            "Two minor pieces forked with one leap!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — EDGE OF BOARD
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=20, fork_type="knight_edge",
        side="white",
        title="Edge Knight, Big Threat",
        opening="Queen's Gambit Declined (Orthodox)",
        line=(
            "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O "
            "6. Nf3 h6 7. Bh4 b6 8. cxd5 exd5 9. Bd3 Bb7 10. O-O "
            "Nbd7 11. Qc2 c5 12. dxc5 bxc5 13. Rac1 Rc8 14. Bg3 "
            "Nh5 15. Bxe7 Qxe7 16. Bxh7+ Kxh7 17. Nxd5 Bxd5 "
            "18. Qxc5 Qxc5 19. Rxc5 Bxf3 20. gxf3 Rfd8 "
            "21. Rfc1 Rd2 22. R5c2 Rxc2 23. Rxc2 Nf4 24. exf4 "
            "Rc3 25. Kf1 Rxa3 26. Ke2 Ra4 27. Ke3 Nf6 28. f5 Nd5+ "
            "29. Kf3 Rxf4+ 30. Kg3 Nb4 31. Rc7 Nd3"
        ),
        best_move_san="Na6",
        story=(
            "The knight retreats all the way to the edge — but from a6 "
            "it attacks the rook on b8 AND c7 at the same time. "
            "Even knights at the rim can deliver devastating forks!"
        ),
    ),

    dict(
        pattern="fork", game_number=21, fork_type="knight_edge",
        side="black",
        title="The Rim Strikes Back",
        opening="Ruy Lopez (Closed)",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 "
            "6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 "
            "11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 "
            "15. a4 c5 16. d5 c4 17. b4 cxb3 18. Bxb3 Nc5 "
            "19. Bc2 bxa4 20. Rxa4 a5 21. Bd2 Bc8 22. Ne2 Bd7 "
            "23. Rb4 Rb8 24. Nf4 Nh5 25. Nxh5 gxh5 26. Rxb8 Qxb8"
        ),
        best_move_san="Na4",
        story=(
            "Your knight hops to the edge of the board — but from a4 "
            "it targets the bishop on b2 AND the rook on b4. Edge "
            "squares look quiet, but they control the right diagonals!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # KNIGHT FORKS — CENTER
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=22, fork_type="knight_center",
        side="white",
        title="The Central Octopus",
        opening="Sicilian Defence (Najdorf)",
        line=(
            "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 "
            "6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O "
            "Nbd7 11. g4 b5 12. g5 Nh5 13. Nd5 Bxd5 14. exd5 Nb6 "
            "15. Bxb6 Qxb6 16. Na5 Qd8 17. Nc6 Qd7 18. Nxe7+ "
            "Qxe7 19. f4 exf4 20. Bxf4 Qe2 21. Qxe2 Nxf4 "
            "22. Qe3 Nxd5 23. Qd3 Nb4 24. Qb3 Nd3+ 25. Rxd3"
        ),
        best_move_san="Ne5",
        story=(
            "The knight vaults to e5 — right in the heart of the board. "
            "From there it attacks the bishop on c6 and the rook on f7 "
            "simultaneously. A centrally-posted knight is a monster!"
        ),
    ),

    dict(
        pattern="fork", game_number=23, fork_type="knight_center",
        side="black",
        title="The d4 Outpost",
        opening="Queen's Indian Defence",
        line=(
            "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb7 5. Bg2 Be7 "
            "6. O-O O-O 7. Nc3 Ne4 8. Qc2 Nxc3 9. Qxc3 c5 "
            "10. Rd1 cxd4 11. Nxd4 Nc6 12. Nxc6 dxc6 13. b3 Qxd1+ "
            "14. Rxd1 Rfd8 15. Rxd8+ Rxd8 16. e4 Bc5 17. Be3 Bxe3 "
            "18. fxe3 Rd2 19. Qc1 Rxg2+!! 20. Kxg2 c5 21. Qc3 "
            "Bc6+ 22. Kh3 Bd7+ 23. Kh4 Bf5 24. e5 g5+ 25. Kh5 "
            "Bxe4 26. Qb2 Bxb1 27. Qxb1 c4 28. bxc4 b5"
        ),
        best_move_san="Nd4",
        story=(
            "Your knight lands on d4 — a beautiful central outpost. "
            "From d4 it forks the bishop on e6 and the rook on c2. "
            "Dominate the centre and everything else falls apart for "
            "your opponent!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # PAWN FORKS — TWO PIECES
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=24, fork_type="pawn_two_pieces",
        side="white",
        title="The Pawn Wedge",
        opening="Sicilian Defence (Scheveningen)",
        line=(
            "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 "
            "6. Be2 Qc7 7. O-O Nc6 8. Be3 Be7 9. f4 d6 10. Kh1 "
            "Nxd4 11. Bxd4 e5 12. fxe5 dxe5 13. Be3 O-O 14. Nd5 "
            "Nxd5 15. exd5 f5"
        ),
        best_move_san="d6",
        story=(
            "The pawn advances to d6 and suddenly attacks two pieces at "
            "once — the queen on c7 and the bishop on e7. Black can only "
            "rescue one of them. A single pawn step creates a fork!"
        ),
    ),

    dict(
        pattern="fork", game_number=25, fork_type="pawn_two_pieces",
        side="white",
        title="Pawn Catches Two Knights",
        opening="King's Indian Defence (Classical)",
        line=(
            "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 O-O "
            "6. Nf3 e5 7. O-O Nc6 8. d5 Ne7 9. Ne1 Nd7 10. f3 f5 "
            "11. g4 Nf6 12. Ng2 fxg4 13. fxg4 c6 14. dxc6 bxc6 "
            "15. g5 Ne8 16. Bg4 Nc7 17. Be6+ Kh8 18. Bg5 Qd7 "
            "19. Bxd7 Bxd7 20. h4 Nb5 21. Nxb5 cxb5 22. h5 Nc6"
        ),
        best_move_san="e5",
        story=(
            "The pawn dashes to e5, forking the knight on d6 and the "
            "knight on f6 at the same time. Neither knight can be "
            "defended, and White wins one for nothing!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # PAWN FORKS — KING + QUEEN
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=26, fork_type="pawn_king_queen",
        side="white",
        title="The Advancing Pawn Check",
        opening="French Defence (Advance)",
        line=(
            "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 "
            "6. Bd3 cxd4 7. cxd4 Bd7 8. O-O Nge7 9. Na3 Nf5 "
            "10. Nc2 Nce7 11. b4 Rc8 12. a3 h6 13. h3 g5 "
            "14. Bxf5 Nxf5 15. Be3 Qd8 16. Rc1 Rxc1 17. Qxc1 "
            "Qb6 18. Nd2 h5 19. g4 hxg4 20. hxg4 Nh4 21. Nf3 "
            "Nxf3+ 22. Qxf3 Bc6 23. Qa8+ Ke7 24. Qc8 Bxe5"
        ),
        best_move_san="e6",
        story=(
            "The pawn strides to e6 with check! The king on f7 must "
            "step away — but the pawn also attacks the queen on d7. "
            "Black is in an impossible position: save the king, "
            "lose the queen."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # PAWN FORKS — PAWN BREAK CREATING FORK
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=27, fork_type="pawn_break_fork",
        side="white",
        title="The Break Opens Everything",
        opening="King's Indian Attack",
        line=(
            "1. e4 c5 2. Nf3 e6 3. d3 Nc6 4. g3 g6 5. Bg2 Bg7 "
            "6. O-O Nge7 7. Nbd2 O-O 8. Re1 d5 9. exd5 exd5 "
            "10. Nb3 b6 11. c3 Ba6 12. d4 cxd4 13. cxd4 Qd7 "
            "14. Bf4 Rac8 15. Ne5 Nxe5 16. Bxe5 Bxe2 17. Rxe2 "
            "Nc6 18. Bxg7 Kxg7 19. Qd2 Qe6 20. Re3 Qd6 "
            "21. Rae1 Rfe8 22. h3 a5 23. a3 b5 24. Nc5 Na7"
        ),
        best_move_san="d5",
        story=(
            "The d-pawn breaks forward! It forks the knight on c6 and "
            "the bishop on e6 at the same time. The pawn break doesn't "
            "just open lines — it wins material on the spot."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # QUEEN FORKS — BACK RANK
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=28, fork_type="queen_back_rank",
        side="black",
        title="Two Rooks on the First Rank",
        opening="Catalan Opening",
        line=(
            "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. g3 Bb4+ 5. Bd2 Be7 "
            "6. Bg2 O-O 7. O-O c6 8. Qc2 Nbd7 9. Rd1 b6 "
            "10. cxd5 exd5 11. Bf4 Bb7 12. Nc3 Rc8 13. Qb3 "
            "Re8 14. Ne5 Nxe5 15. Bxe5 Bd6 16. Bxd6 Qxd6 "
            "17. e3 c5 18. dxc5 bxc5 19. Rdc1 d4 20. Nd1 dxe3 "
            "21. fxe3 Qxe3+ 22. Kh1 Rcd8 23. Qe6 Qxe6 24. Nf2 "
            "Nd5 25. Rd1 Rxd1+ 26. Rxd1 Nxf2+ 27. Rxf2 Re1+"
        ),
        best_move_san="Qa3",
        story=(
            "Your queen slides to a3 and hits both the rook on a1 AND "
            "the rook on d1 at the same time! White cannot protect both "
            "back-rank rooks in one move."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # QUEEN FORKS — WITH CHECK
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=29, fork_type="queen_check_fork",
        side="white",
        title="Queen Check and Grab",
        opening="Caro-Kann Defence (Classical)",
        line=(
            "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 "
            "6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 "
            "10. Qxd3 e6 11. Bd2 Ngf6 12. O-O Ng4 13. Bf4 f6"
        ),
        best_move_san="Qg6+",
        story=(
            "Your queen swoops to g6 with check! The king on e8 has to "
            "deal with the check — but the queen also attacks the "
            "undefended knight on g4. Save the king first, lose "
            "the knight next."
        ),
    ),

    dict(
        pattern="fork", game_number=30, fork_type="queen_check_fork",
        side="white",
        title="Royal Check with a Side Order",
        opening="Philidor Defence",
        line=(
            "1. e4 e5 2. Nf3 d6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 "
            "Be7 6. Bc4 O-O 7. O-O c6 8. Bb3 d5 9. exd5 cxd5 "
            "10. Nxd5 Nxd5 11. Bxd5 Nc6 12. Nxc6 bxc6 13. Bxc6 "
            "Rb8 14. Qd3 Bg4 15. f3 Bd7 16. c4 Ba4 17. Bxa4 Qxa4 "
            "18. b3 Qa3 19. Bb2 Rbc8 20. Rfd1 Rfd8 21. Rd2 Rxd2 "
            "22. Qxd2 Rd8 23. Qe3 Bb4 24. Bd4 Bc3 25. Bxc3 Rxd1+ "
            "26. Bxd1 Qxb3 27. Bb3"
        ),
        best_move_san="Qb6+",
        story=(
            "The queen checks the king on g8 from b6 AND attacks the "
            "bishop on c7 at the same time. One move — one check — "
            "and Black cannot save both pieces."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # QUEEN FORKS — AFTER SACRIFICE
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=31, fork_type="queen_sacrifice_fork",
        side="white",
        title="Give to Get Two",
        opening="Sicilian Defence (Dragon)",
        line=(
            "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 "
            "6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. O-O-O d5 "
            "10. exd5 Nxd5 11. Nxc6 bxc6 12. Nxd5 cxd5 13. Qxd5 "
            "Be6 14. Qxa8 Qxa8 15. Bc4 Qd8 16. Bxe6 fxe6 "
            "17. Rxd8 Rxd8 18. Rd1 Rxd1+ 19. Kxd1 Bxb2 "
            "20. Kc2 Bg7 21. Kd3 Kf7 22. Ke4 Ke7 23. Kf4 "
            "Kf6 24. Kg4 e5 25. h4 h5+ 26. Kf3 e4+"
        ),
        best_move_san="Qa5+",
        story=(
            "First the queen is sacrificed to strip away the defenders. "
            "Then the smaller pieces are traded off. When the position "
            "clears, the queen slides back with a fork — checking the "
            "king and attacking the undefended piece at once."
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # ROOK FORKS — HORIZONTAL
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=32, fork_type="rook_horizontal",
        side="white",
        title="Rook Sweeps the Seventh",
        opening="Queen's Gambit (Exchange Variation)",
        line=(
            "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 "
            "6. O-O a6 7. Qe2 b5 8. Bd3 Bb7 9. Nc3 Nc6 10. a3 "
            "cxd4 11. exd4 Be7 12. Bg5 O-O 13. Rfe1 Nb4 "
            "14. Bb1 Re8 15. a4 bxa4 16. Rxa4 Nd5 17. Nxd5 exd5 "
            "18. Bxe7 Rxe7 19. Rxa6 Bxa6 20. Qxa6 Nc6 21. Qa5 "
            "Re6 22. Qxd8+ Nxd8 23. Re5 Nf7 24. Rxd5 Re1+ "
            "25. Nxe1 g6 26. Rd7 Rb8 27. Nd3 Ne5 28. Nxe5 "
            "Rxb2 29. Nd7"
        ),
        best_move_san="Rxf7",
        story=(
            "The rook slashes across the seventh rank, taking the pawn "
            "on f7 and immediately attacking the knight on a7 AND the "
            "rook on h7 along the same rank. Rooks on the seventh rank "
            "are fearsome — they reach both sides of the board!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # ROOK FORKS — VERTICAL
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=33, fork_type="rook_vertical",
        side="white",
        title="The Open File Skewer",
        opening="Grünfeld Defence",
        line=(
            "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 "
            "Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Rb1 O-O 9. Be2 cxd4 "
            "10. cxd4 Qa5+ 11. Bd2 Qxa2 12. O-O Bg4 13. Rxb7 "
            "Bxf3 14. Bxf3 Nc6 15. d5 Nd4 16. Bxd4 Bxd4 "
            "17. Rxd7 Rad8 18. Rxd8 Rxd8 19. Qa1 Qb2 20. Qxb2 "
            "Bxb2 21. Rb1 Bd4 22. Rxb7 a5 23. Ra7 Rb8 "
            "24. e5 Rb1+ 25. Kf1 a4 26. f4 a3 27. Ke2 a2 "
            "28. Kd3 Bg1 29. h3 h5"
        ),
        best_move_san="Rd1",
        story=(
            "The rook slides down the d-file and attacks the queen on "
            "d8 AND the bishop on d3 along the same file. A rook on an "
            "open file controls everything in its path — including "
            "two enemy pieces at once!"
        ),
    ),

    # ══════════════════════════════════════════════════════════════
    # ORIGINAL 10 USER EXAMPLES — EXTENDED TO FULL GAMES
    # ══════════════════════════════════════════════════════════════

    dict(
        pattern="fork", game_number=34, fork_type="knight_king_queen",
        side="white",
        title="Classic f7 Attack",
        opening="Two Knights Defence",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. O-O d6 "
            "6. Nc3 Be6 7. Bxe6 fxe6 8. Ng5 Qd7 9. h3 Rf8 "
            "10. Be3 Bxe3 11. fxe3 Ne7 12. Ne2 d5 13. Ng3 d4 "
            "14. exd4 exd4 15. Qe2 Nc6 16. Ngf5 Qe6"
        ),
        best_move_san="Nxf7",
        story=(
            "The knight on f5 captures on f7 with check! After the "
            "knight lands, it attacks the queen on d8 and the rook on "
            "h8 — the classic f7 fork pattern that beginners must know."
        ),
    ),

    dict(
        pattern="fork", game_number=35, fork_type="knight_king_rook",
        side="white",
        title="Queen Out Early Punishment",
        opening="Scotch Gambit",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4 Bc5 5. c3 "
            "Nf6 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. bxc3 "
            "d5 10. Bxd5 Qxd5 11. Re1 Be6 12. Rxe4 O-O-O "
            "13. Ng5 Bg4 14. f3 Be6 15. Nxe6 fxe6 16. Rxe6 Rde8 "
            "17. Rxe8+ Rxe8 18. Qb3 Qd7 19. Bg5 Na5 20. Qa4"
        ),
        best_move_san="Nc4",
        story=(
            "White's knight hops to c4, checking the king and "
            "attacking the rook. When queens venture out too early "
            "they can end up on vulnerable squares — and a single "
            "knight move punishes both the king and the rook."
        ),
    ),

    dict(
        pattern="fork", game_number=36, fork_type="knight_king_rook",
        side="white",
        title="Scandinavian Nc7 Fork",
        opening="Scandinavian Defence (3...Nf6)",
        line=(
            "1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 "
            "6. dxe6 Bxe6 7. Nc3 c6 8. Bg5 Be7 9. Qd2 h6 "
            "10. Bxf6 Bxf6 11. Nge2 O-O 12. O-O-O Nd7 13. g4 "
            "Bg6 14. h4 Qa5 15. g5 hxg5 16. hxg5 Bxg5 17. Nxg5 "
            "Qxg5 18. Qxg5 Ne5 19. Kb1 Nxc4 20. Qe3 Nb6 "
            "21. Na4 Nxa4 22. Bxa4 Rfd8 23. Bb3"
        ),
        best_move_san="Nc7+",
        story=(
            "The knight charges to c7 with check! The king on e8 "
            "must move — but the rook on a8 cannot escape. A quick "
            "Nc7+ forks king and rook, winning the exchange."
        ),
    ),

    dict(
        pattern="fork", game_number=37, fork_type="knight_queen_rook",
        side="white",
        title="Fried Liver Attack",
        opening="Two Knights Defence (Ng5 variation)",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 "
            "6. d4 exd4"
        ),
        best_move_san="Nxf7",
        story=(
            "The famous Fried Liver Attack! The knight sacrifices "
            "itself on f7, attacking the queen on d8 AND the rook on "
            "h8 in one swoop. This is one of the most important tactical "
            "patterns for every chess student to know."
        ),
    ),

    dict(
        pattern="fork", game_number=38, fork_type="knight_king_rook",
        side="white",
        title="The c7 Royal Fork",
        opening="Ruy Lopez (Exchange)",
        line=(
            "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O "
            "f6 6. d4 exd4 7. Nxd4 c5 8. Nb3 Qe7 9. Be3 Bd6 "
            "10. Nc3 Be6 11. Nd5 Qd7 12. f3 Ne7 13. Qd2 O-O-O "
            "14. Nbc7+ Kc8 15. Nxa8"
        ),
        best_move_san="Nc6+",
        story=(
            "The knight dives to c6, checking the king and attacking "
            "the rook at the same time. In the Ruy Lopez Exchange, "
            "Black's kingside pawns are weak and the king often stays "
            "in the centre — exactly where the Nc7+ fork strikes!"
        ),
    ),

    dict(
        pattern="fork", game_number=39, fork_type="knight_king_queen",
        side="white",
        title="Queen on d7 Punished",
        opening="Queen's Gambit Declined (Tartakower)",
        line=(
            "1. d4 d5 2. Nf3 Nf6 3. c4 e6 4. Nc3 Be7 5. Bg5 h6 "
            "6. Bh4 O-O 7. e3 b6 8. cxd5 exd5 9. Bd3 Bb7 "
            "10. O-O Nbd7 11. Qc2 c5 12. dxc5 bxc5 13. Rac1 "
            "Rc8 14. Bg3 Nh5 15. Bxe7 Qxe7 16. Ne5 Nxe5 "
            "17. Bxh7+ Kh8 18. dxe5 Qd7 19. Bf5"
        ),
        best_move_san="Nd5",
        story=(
            "The knight lands on d5 — attacking the queen on d7 AND "
            "a piece on e7 at the same time. When Black's queen wanders "
            "to d7 without proper support, a knight fork is never far "
            "away."
        ),
    ),

    dict(
        pattern="fork", game_number=40, fork_type="knight_king_queen",
        side="white",
        title="Scholar's Mate Gone Wrong",
        opening="King's Pawn Opening",
        line=(
            "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7+ Ke7 "
            "5. Qxg7 Rg8 6. Qxh7 d5 7. exd5 Nd4 8. Bb3 Bg4 "
            "9. Nf3 Nxf3+ 10. gxf3 Bh3 11. d6+ cxd6 12. Nc3 "
            "Kf7 13. Bg5 Qa5 14. Nd5 Nxd5 15. Bxd5+ Ke6 "
            "16. c4 Rc8 17. f4 Bc5 18. fxe5 Rxg1+ 19. Rxg1 "
            "Kxd5 20. Rd1+ Ke4 21. Qg6+ Ke3 22. Qf5 Qd2+"
        ),
        best_move_san="Nc7+",
        story=(
            "After White's greedy queen tour, Black's king is out in "
            "the open. A knight check on c7 hits the king and the rook "
            "at the same time — the Scholar's Mate trick backfired and "
            "became a fork!"
        ),
    ),

    dict(
        pattern="fork", game_number=41, fork_type="knight_king_queen",
        side="white",
        title="King's Indian Fork",
        opening="King's Indian Defence (Sämisch)",
        line=(
            "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O "
            "6. Be3 Nc6 7. Nge2 a6 8. Qd2 Rb8 9. O-O-O b5 "
            "10. cxb5 axb5 11. Kb1 b4 12. Nd5 Nxd5 13. exd5 "
            "Na5 14. g4 c6 15. dxc6 Nxc6 16. Nc1 e5 17. dxe5 "
            "dxe5 18. Nd3 f5 19. Nxe5 Nxe5 20. Bxb6 Qxb6 "
            "21. gxf5 gxf5 22. Bh3 Be6 23. Bxf5 Bxf5 "
            "24. Rhg1 Rbe8 25. Qe3 Qc7"
        ),
        best_move_san="Nd5",
        story=(
            "The knight occupies d5 — the dream square. From there it "
            "attacks the queen on c7 and the bishop on e7 at the same "
            "time. King's Indian positions often produce this powerful "
            "central knight fork."
        ),
    ),
]
