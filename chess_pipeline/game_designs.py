"""Authored practice-game designs for ChessQuest levels.

Each design is a full SAN line from the standard start position plus the
student's pattern move. `build_games.py` validates every design with the
pattern detectors and emits scripts/scripted_games_data.json.

Design rules (enforced by chess_pipeline.verify_games):
  - >= 15 scripted plies before the pattern move
  - the pattern move passes the pattern detector
  - within a level: different openings, positions, and pattern moves
"""

PRACTICE_DESIGNS = [
    # ── Level 1: FORK ────────────────────────────────────────────
    dict(
        pattern="fork", game_number=1, side="white",
        title="The Pawn Wedge",
        opening="Italian Game",
        line="1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7 4. d3 Nf6 5. O-O O-O 6. Re1 d6 "
             "7. c3 Be6 8. Bb3 h6 9. d4 exd4 10. cxd4 Re8",
        best_move_san="d5",
        story="A quiet Italian — until White's center pawn marches forward "
              "and attacks the knight and bishop at the same time!",
    ),
    dict(
        pattern="fork", game_number=2, side="black",
        title="Knight Storm on e3",
        opening="Four Knights Game",
        line="1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bb4 5. O-O O-O 6. d3 d6 "
             "7. Bg5 Bxc3 8. bxc3 Qe7 9. Bh4 Bd7 10. Ng5 Ng4 11. f3",
        best_move_san="Ne3",
        story="White attacks your knight with a pawn — but instead of "
              "retreating, your knight leaps INTO the fork!",
    ),
    dict(
        pattern="fork", game_number=3, side="white",
        title="Queen's Double Strike",
        opening="Caro-Kann Defence",
        line="1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 "
             "7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6 11. Bd2 Ngf6 "
             "12. O-O Ng4 13. Bf4 f6",
        best_move_san="Qg6+",
        story="Black weakened the light squares around the king. Your queen "
              "checks the king AND attacks the stray knight!",
    ),
    dict(
        pattern="fork", game_number=4, side="black",
        title="The Knight Grabs Two",
        opening="King's Indian Defence",
        line="1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 "
             "7. O-O Nc6 8. d5 Ne7 9. b4 Nh5 10. Re1 f5 11. Nh4 Nf6 12. Bg5",
        best_move_san="Nxe4",
        story="White's pieces wandered off. Your knight captures a pawn and "
              "attacks the bishop and knight at the same time!",
    ),
    dict(
        pattern="fork", game_number=5, side="white",
        title="Bishop Snatches the Royal Pair",
        opening="Sicilian Najdorf",
        line="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 e5 "
             "7. Nb3 Be7 8. O-O O-O 9. Be3 Be6 10. Bg5 Nbd7 11. Nd5 Ng4",
        best_move_san="Bxe7",
        story="Black left the bishop on e7 poorly guarded. Capture it — your "
              "bishop will attack the queen and the rook at once!",
    ),

    # ── Level 2: PIN ─────────────────────────────────────────────
    dict(
        pattern="pin", game_number=1, side="white",
        title="The Frozen Knight",
        opening="Ponziani Opening",
        line="1. e4 e5 2. Nf3 Nc6 3. c3 Nf6 4. d3 d6 5. Nbd2 g6 6. h3 Bg7 "
             "7. d4 exd4 8. cxd4 h5",
        best_move_san="Bb5",
        story="Black's king is still in the centre. Pin the knight to the "
              "king — it cannot move at all!",
    ),
    dict(
        pattern="pin", game_number=2, side="black",
        title="Rook on the Open File",
        opening="Exchange French",
        line="1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Bd6 5. Bd3 Nf6 6. Bg5 O-O "
             "7. Nbd2 h6 8. Bh4 c6 9. Ne5",
        best_move_san="Re8",
        story="White's knight jumped to e5 — but the white king is still in "
              "the centre. Pin the knight with your rook!",
    ),
    dict(
        pattern="pin", game_number=3, side="black",
        title="The Classic Bishop Pin",
        opening="Italian Game (Giuoco Pianissimo)",
        line="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. Nc3 d6 6. a3 O-O "
             "7. Ba2 Re8 8. O-O",
        best_move_san="Bg4",
        story="The white knight on f3 stands right in front of the queen. "
              "Pin it — now it cannot jump anywhere!",
    ),
    dict(
        pattern="pin", game_number=4, side="white",
        title="Queen Pins from the Edge",
        opening="Tarrasch Defence",
        line="1. d4 d5 2. c4 e6 3. Nc3 c5 4. cxd5 exd5 5. Nf3 Nc6 6. g3 Nf6 "
             "7. Bg2 Be7 8. Bg5 a6",
        best_move_san="Qa4",
        story="Black's king lingers in the centre. Your queen pins the "
              "knight from the side of the board!",
    ),
    dict(
        pattern="pin", game_number=5, side="white",
        title="Rook Pin Wins the Knight",
        opening="Petroff Defence (Steinitz)",
        line="1. e4 e5 2. Nf3 Nf6 3. d4 Nxe4 4. Bd3 d5 5. Nxe5 Nd7 6. Nxd7 "
             "Bxd7 7. O-O Bd6 8. c4 c6",
        best_move_san="Re1",
        story="Black's knight sits proudly on e4 — but the king behind it "
              "has not castled. Pin it and pile on!",
    ),

    # ── Level 3: BACK RANK MATE ─────────────────────────────────
    dict(
        pattern="back_rank_mate", game_number=1, side="white",
        title="The Greedy Queen Pays",
        opening="Scotch Game",
        line="1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 "
             "6. Bd3 d5 7. exd5 cxd5 8. O-O Be7 9. Re1 O-O 10. Bg5 Re8 "
             "11. Bxf6 Bxf6 12. Rxe8+ Qxe8 13. Nd2 Qa4 14. Qf3 c6 "
             "15. Re1 Qxa2",
        best_move_san="Re8#",
        story="Black's queen wandered off to grab pawns and nobody guards "
              "the back rank. Slide your rook in for checkmate!",
    ),
    dict(
        pattern="back_rank_mate", game_number=2, side="black",
        title="Punish the Pawn Grabber",
        opening="Exchange French",
        line="1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Bd6 5. Bd3 Nf6 6. O-O O-O "
             "7. Re1 Bf5 8. c3 Bxd3 9. Qxd3 Nc6 10. a3 Qd7 11. b4 Rae8 "
             "12. Rxe8 Rxe8 13. Ng5 h6 14. Qb5 hxg5 15. Qxb7",
        best_move_san="Re1#",
        story="White went hunting your b-pawn while the back door stood "
              "wide open. Deliver the famous back rank mate!",
    ),
    dict(
        pattern="back_rank_mate", game_number=3, side="white",
        title="Queen Slides Home",
        opening="Scotch Four Knights",
        line="1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. d4 exd4 5. Nxd4 Bb4 "
             "6. Nxc6 bxc6 7. Bd3 d5 8. exd5 cxd5 9. O-O O-O 10. Bg5 Re8 "
             "11. Re1 Rxe1+ 12. Qxe1 Ba5 13. Bxf6 Qxf6 14. h3 Qb6 "
             "15. Kh2 Qxb2",
        best_move_san="Qe8#",
        story="Black grabbed the b-pawn with the queen — and left the "
              "whole eighth rank to you. March your queen in!",
    ),
    dict(
        pattern="back_rank_mate", game_number=4, side="black",
        title="Mate Beats Material",
        opening="Petroff Defence",
        line="1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 "
             "6. Bd3 Bd6 7. O-O O-O 8. c4 c6 9. Nc3 Nxc3 10. bxc3 Bg4 "
             "11. Re1 Re8 12. Rxe8+ Qxe8 13. a4 Bxf3 14. Qxf3 Nd7 "
             "15. c5 Bc7 16. Bxh7+ Kxh7 17. Qxd5",
        best_move_san="Qe1#",
        story="White is grabbing pawns everywhere — you could win the "
              "queen, but there is something much better. Mate first!",
    ),
    dict(
        pattern="back_rank_mate", game_number=5, side="white",
        title="Corner the Castled King",
        opening="Scandinavian Defence",
        line="1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 "
             "6. Be2 Bg4 7. O-O Nc6 8. Be3 O-O-O 9. d5 Nb4 10. Bxa6 bxa6 "
             "11. Rab1 e6 12. dxe6 Bxf3 13. Qxf3 h5",
        best_move_san="Qa8#",
        story="Black castled queenside, but the pawn shield is gone. Your "
              "queen sails down the long diagonal to the corner — mate!",
    ),

    # ── Level 4: SKEWER ──────────────────────────────────────────
    dict(
        pattern="skewer", game_number=1, side="white",
        title="Rook X-Ray on the d-File",
        opening="Queen's Gambit Accepted",
        line="1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 "
             "7. dxc5 Bxc5 8. Qe2 b5 9. Bb3 Bb7 10. a3 O-O 11. Nc3 Qd7 "
             "12. h3 Rfd8 13. e4 h6",
        best_move_san="Rfd1",
        story="Black lined up the queen IN FRONT of the rook on the open "
              "file. Attack the queen — when she runs, the rook falls!",
    ),
    dict(
        pattern="skewer", game_number=2, side="black",
        title="Skewer the Battery",
        opening="Scotch Game",
        line="1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 "
             "6. Bd3 d5 7. exd5 cxd5 8. O-O Be7 9. Qe2 O-O 10. Re1 Bd6 "
             "11. Nd2",
        best_move_san="Re8",
        story="White stacked the queen in front of the rook on the e-file. "
              "Your rook attacks both at once — the queen cannot stay!",
    ),
    dict(
        pattern="skewer", game_number=3, side="white",
        title="The Long Diagonal Sting",
        opening="Scandinavian Defence",
        line="1. e4 d5 2. exd5 Qxd5 3. Be2 Nf6 4. Nh3 b6 5. O-O e6 "
             "6. d4 Bd6 7. b3 Nbd7 8. Bb2 Bb7",
        best_move_san="Bf3",
        story="Black's queen and bishop share the same long diagonal. Slide "
              "your bishop onto it — the queen must flee and the bishop is "
              "yours!",
    ),
    dict(
        pattern="skewer", game_number=4, side="black",
        title="Raid from h6",
        opening="Centre Game",
        line="1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 g6 5. Bc4 Nf6 6. h3 d6 "
             "7. Nf3 Bd7 8. a4 h5 9. a5",
        best_move_san="Bh6",
        story="White's early queen stands on the same diagonal as the "
              "sleeping bishop on c1. Skewer them both!",
    ),
    dict(
        pattern="skewer", game_number=5, side="white",
        title="Bishop Spears the Queen",
        opening="Open Sicilian",
        line="1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. Nc3 Bg7 "
             "6. Be3 Nf6 7. Be2 O-O 8. O-O d6 9. h3 Nxd4 10. Bxd4 Qd7 "
             "11. Qd2 Rfe8",
        best_move_san="Bb5",
        story="The black queen stepped in front of her own rook on the "
              "light diagonal. Spear her — the rook is the prize!",
    ),

    # ── Level 5: DISCOVERED ATTACK ──────────────────────────────
    dict(
        pattern="discovered_attack", game_number=1, side="white",
        title="The Knight Steps Aside",
        opening="Scandinavian Defence",
        line="1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 "
             "6. Bd2 e6 7. Be2 Nc6 8. O-O Be7",
        best_move_san="Nb5",
        story="Your knight jumps away and suddenly the bishop behind it "
              "glares at the black queen — while the knight eyes c7!",
    ),
    dict(
        pattern="discovered_attack", game_number=2, side="black",
        title="Unmask the Dragon",
        opening="King's Indian Defence",
        line="1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 "
             "7. O-O exd4 8. Qxd4 Re8 9. Rd1",
        best_move_san="Nxe4",
        story="Your knight grabs a pawn AND unmasks the dragon bishop on "
              "g7 — it now stares straight at the white queen!",
    ),
    dict(
        pattern="discovered_attack", game_number=3, side="black",
        title="The Pinned Knight Strikes Back",
        opening="Advance French",
        line="1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. Qa4 Bd7 "
             "7. Be2 cxd4 8. cxd4 Nge7 9. O-O Nf5 10. Nc3",
        best_move_san="Ncxd4",
        story="White thinks the knight is frozen by the queen's stare. But "
              "your bishop guards the path — capture the pawn and reveal "
              "the counter-attack!",
    ),
    dict(
        pattern="discovered_attack", game_number=4, side="white",
        title="Clear the Runway",
        opening="Réti Opening",
        line="1. Nf3 d5 2. c4 dxc4 3. g3 Nf6 4. Bg2 b5 5. a4 c6 6. axb5 cxb5 "
             "7. b3 cxb3 8. Qxb3 e6 9. O-O Ba6 10. Bb2 Ng4",
        best_move_san="Ne5",
        story="Your knight leaps to the centre and attacks the stray knight — "
              "and behind it, your fianchetto bishop suddenly sees all the "
              "way to the rook in the corner!",
    ),
    dict(
        pattern="discovered_attack", game_number=5, side="black",
        title="The Little Pawn's Big Secret",
        opening="Nimzo-Indian Defence",
        line="1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 d5 5. cxd5 exd5 6. Bg5 h6 "
             "7. Bh4 Bf5 8. e3 O-O 9. Be2 Nbd7 10. Bd3 Bh7 11. Nf3 g6 "
             "12. Bb5",
        best_move_san="g5",
        story="Push the little pawn! It chases the white bishop — and behind "
              "it, your own bishop suddenly glares at the white queen. Two "
              "threats with one tiny move!",
    ),
]

# ── Main games (game 6 of each level) ────────────────────────────
# The pgn is the full drive mainline INCLUDING the student's pattern
# moves. checkpoints mark the plies where the student's mainline move
# passes the named detector. target_patterns is cumulative: the live
# appreciation system rewards ANY of these patterns during free play.
MAIN_DESIGNS = [
    dict(
        pattern="fork", game_number=6, side="white",
        title="The Royal Fork",
        opening="Exchange Ruy Lopez",
        line="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O f6 "
             "6. d4 exd4 7. Nxd4 c5 8. Nb3 Qxd1 9. Rxd1 Bg4 10. f3 Be6 "
             "11. Nc3 Bd6 12. Nd5 Be7 13. Nxc7+ Kf7 14. Nxa8",
        story="The queens are gone, but the tactics are not. When the "
              "bishop steps away from c7, your knight dives in with check — "
              "royal fork! The king must move, and the corner rook is yours.",
        target_patterns=["fork"],
        checkpoints=[{"ply": 24, "pattern": "fork"}],
    ),
    dict(
        pattern="pin", game_number=6, side="black",
        title="Freeze the Knight, Win the Game",
        opening="Vienna Game (g3)",
        line="1. e4 e5 2. Nc3 Nf6 3. g3 d5 4. exd5 Nxd5 5. Bg2 Nxc3 "
             "6. bxc3 Bd6 7. Nf3 O-O 8. O-O Nc6 9. Re1 Re8 10. d3 h6 "
             "11. Be3 Bg4",
        story="White's knight stands right in front of the queen. Slide "
              "your bishop out and freeze it — then keep piling on the "
              "pressure until it falls!",
        target_patterns=["fork", "pin"],
        checkpoints=[{"ply": 21, "pattern": "pin"}],
    ),
    dict(
        pattern="back_rank_mate", game_number=6, side="white",
        title="Bait the Queen, Mate the King",
        opening="Exchange Slav",
        line="1. d4 d5 2. c4 c6 3. cxd5 cxd5 4. Nc3 Nf6 5. Nf3 Nc6 "
             "6. Bf4 Bf5 7. e3 e6 8. Bd3 Bxd3 9. Qxd3 Bd6 10. Bxd6 Qxd6 "
             "11. O-O O-O 12. Rfc1 Rfc8 13. h3 a6 14. Ne5 Nxe5 15. dxe5 "
             "Qxe5 16. Ne2 Qxb2 17. Rxc8+ Rxc8 18. Qd1 Qxa2 19. Rc1 Rxc1 "
             "20. Qxc1 Ne4 21. Qc8#",
        story="Let the greedy queen gobble your little pawns — every snack "
              "pulls her further from home. Trade the rooks, and when the "
              "last defender leaps away, your queen slides to c8. Checkmate!",
        target_patterns=["fork", "pin", "back_rank_mate"],
        checkpoints=[{"ply": 40, "pattern": "back_rank_mate"}],
    ),
    dict(
        pattern="skewer", game_number=6, side="black",
        title="Battery Backfire",
        opening="Colle System (vs fianchetto)",
        line="1. d4 d5 2. Nf3 Nf6 3. e3 g6 4. Bd3 Bg7 5. O-O O-O "
             "6. Nbd2 c5 7. c3 Nc6 8. Re1 b6 9. Bc2 Qc7 10. Qe2 Re8 "
             "11. Qd3 Bf5 12. Qb5 Bxc2",
        story="White lined up queen and bishop, aiming at your king. But "
              "the queen stands in FRONT — slide your bishop out, guarded "
              "by its pawn, and skewer her! When she runs, the bishop "
              "behind her is yours.",
        target_patterns=["fork", "pin", "back_rank_mate", "skewer"],
        checkpoints=[{"ply": 21, "pattern": "skewer"}],
    ),
    dict(
        pattern="discovered_attack", game_number=6, side="white",
        title="The f7 Thunderbolt",
        opening="Scandinavian Defence (Qd6)",
        line="1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 "
             "6. g3 b5 7. Bg2 Bb7 8. O-O e6 9. Ne5 Nbd7 10. Bf4 O-O-O "
             "11. Nxf7 Qe7 12. Nxh8",
        story="Your knight snatches the f7 pawn — and behind it, the "
              "bishop on f4 glares straight at the black queen! While she "
              "scrambles away, the knight gobbles the rook in the corner.",
        target_patterns=["fork", "pin", "back_rank_mate", "skewer",
                         "discovered_attack"],
        checkpoints=[{"ply": 20, "pattern": "discovered_attack"}],
    ),
]
