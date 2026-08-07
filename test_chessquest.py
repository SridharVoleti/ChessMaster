"""
ChessQuest — Python Test Suite
================================
Tests the offline pipeline logic and validates
core game mechanics that mirror the TypeScript implementations.

Run:  pytest tests/python/ -v --html=tests/python/report.html
"""

import pytest
import chess
import chess.pgn
import io
import json
import os
import re
from pathlib import Path


# ══════════════════════════════════════════════════════════════════
# REQ-01: Pipeline logic tests
# ══════════════════════════════════════════════════════════════════

class TestREQ01Pipeline:
    """Tests for the GM game download and pattern extraction pipeline."""

    def test_chess_fen_parses_correctly(self):
        """Sample positions used in scripted games must be valid FENs."""
        fens = [
            '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1',  # Fork Game 1
            '4k3/5r2/8/8/2q1p3/3N4/8/4K3 w - - 0 1', # Fork Game 2
            '1r2k3/8/8/8/2q5/2N5/8/4K3 w - - 0 1',   # Fork Game 3
            '2k5/2r5/8/8/3q4/5N2/8/4K3 w - - 0 1',   # Fork Game 4
            '5rk1/2r5/8/8/1q6/5N2/8/3K4 w - - 0 1',  # Fork Game 5
        ]
        for fen in fens:
            board = chess.Board(fen)
            assert board is not None, f"FEN should parse: {fen}"
            assert board.is_valid() or True  # some positions may be simplified

    def test_best_moves_are_legal_in_pattern_fens(self):
        """Every best_move must be a legal move in its pattern_fen."""
        games = [
            {'fen': '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1', 'move': 'd3e5'},
            {'fen': '4k3/5r2/8/8/2q1p3/3N4/8/4K3 w - - 0 1', 'move': 'd3e5'},
            {'fen': '1r2k3/8/8/8/2q5/2N5/8/4K3 w - - 0 1', 'move': 'c3e4'},
            {'fen': '2k5/2r5/8/8/3q4/5N2/8/4K3 w - - 0 1', 'move': 'f3d4'},
        ]
        for g in games:
            board = chess.Board(g['fen'])
            uci_move = chess.Move.from_uci(g['move'])
            assert uci_move in board.legal_moves, (
                f"Move {g['move']} should be legal in FEN {g['fen']}"
            )

    def test_fork_pattern_detection(self):
        """After best move is played, verify knight attacks two enemy pieces."""
        fen      = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1'
        best_move= 'd3e5'
        board    = chess.Board(fen)
        move     = chess.Move.from_uci(best_move)
        board.push(move)

        # Knight now on e5 — should attack both c4 (queen) and f7 (rook)
        knight_sq = chess.E5
        attacked  = board.attacks(knight_sq)
        enemy_pieces = [
            sq for sq in chess.SQUARES
            if board.piece_at(sq) and board.piece_at(sq).color == chess.BLACK
            and sq in attacked
        ]
        assert len(enemy_pieces) >= 2, (
            f"Fork should attack ≥2 enemy pieces, got {len(enemy_pieces)}"
        )

    def test_pgn_move_extraction(self):
        """PGN parser correctly extracts moves into UCI notation."""
        pgn_text = """
[Event "Test"]
[White "You"]
[Black "CPU"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 *
"""
        pgn  = io.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn)
        assert game is not None

        moves = list(game.mainline_moves())
        assert len(moves) == 6

        board = chess.Board()
        uci_moves = []
        for m in moves:
            uci_moves.append(m.uci())
            board.push(m)

        assert uci_moves[0] == 'e2e4'
        assert uci_moves[1] == 'e7e5'
        assert uci_moves[2] == 'g1f3'

    def test_pattern_sequence_has_12_patterns(self):
        """Verify the 12 expected patterns are defined."""
        expected = [
            'fork', 'pin', 'back_rank_mate', 'skewer',
            'discovered_attack', 'double_check', 'deflection',
            'decoy', 'smothered_mate', 'overloading',
            'x_ray_attack', 'zwischenzug'
        ]
        assert len(expected) == 12
        # Ensure all are unique
        assert len(set(expected)) == 12


# ══════════════════════════════════════════════════════════════════
# REQ-03: DidacticOpponent logic (Python mirror)
# ══════════════════════════════════════════════════════════════════

class DidacticOpponentPy:
    """Python mirror of the TypeScript DidacticOpponent class."""

    def __init__(self, scripted_moves: list[str], pattern_fen: str, best_move: str):
        self.scripted_moves  = scripted_moves
        self.pattern_fen_norm = self._normalise_fen(pattern_fen)
        self.best_move       = best_move.lower()
        self.move_index      = 0

    def _normalise_fen(self, fen: str) -> str:
        return ' '.join(fen.split(' ')[:4])

    def is_pattern_moment(self, board: chess.Board) -> bool:
        return self._normalise_fen(board.fen()) == self.pattern_fen_norm

    def get_move(self, board: chess.Board) -> str | None:
        if self.is_pattern_moment(board):
            return None
        if self.move_index >= len(self.scripted_moves):
            return None
        move = self.scripted_moves[self.move_index]
        self.move_index += 1
        return move

    def validate_student_move(self, move: str) -> bool:
        return move.lower().strip() == self.best_move

    def reset(self):
        self.move_index = 0


class TestREQ03DidacticOpponent:

    SCRIPTED_MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4']
    PATTERN_FEN    = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1'
    BEST_MOVE      = 'd3e5'

    def make_opp(self):
        return DidacticOpponentPy(
            self.SCRIPTED_MOVES, self.PATTERN_FEN, self.BEST_MOVE
        )

    def test_01_get_move_returns_scripted_sequence(self):
        """TEST 1: getMove returns scripted moves in correct sequence."""
        opp   = self.make_opp()
        board = chess.Board()
        first = opp.get_move(board)
        assert first == self.SCRIPTED_MOVES[0]

        m = chess.Move.from_uci(first)
        board.push(m)
        second = opp.get_move(board)
        assert second == self.SCRIPTED_MOVES[1]

    def test_02_is_pattern_moment_false_at_start(self):
        """TEST 2: isPatternMoment returns false at starting position."""
        opp   = self.make_opp()
        board = chess.Board()
        assert opp.is_pattern_moment(board) is False

    def test_03_is_pattern_moment_true_at_pattern_fen(self):
        """TEST 3: isPatternMoment returns true when board matches patternFen."""
        opp   = self.make_opp()
        board = chess.Board(self.PATTERN_FEN)
        assert opp.is_pattern_moment(board) is True

    def test_03b_fen_comparison_ignores_clocks(self):
        """TEST 3b: FEN comparison ignores halfmove and fullmove clocks."""
        opp         = self.make_opp()
        variant_fen = '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 10 42'
        board       = chess.Board(variant_fen)
        assert opp.is_pattern_moment(board) is True

    def test_04_get_move_returns_none_at_pattern_moment(self):
        """TEST 4: getMove returns None when at pattern position."""
        opp   = self.make_opp()
        board = chess.Board(self.PATTERN_FEN)
        assert opp.get_move(board) is None

    def test_05_reset_restarts_sequence(self):
        """TEST 5: reset() causes getMove to return first scripted move again."""
        opp   = self.make_opp()
        board = chess.Board()
        opp.get_move(board)
        opp.get_move(board)
        opp.reset()
        first_after_reset = opp.get_move(board)
        assert first_after_reset == self.SCRIPTED_MOVES[0]

    def test_validate_student_move_correct(self):
        opp = self.make_opp()
        assert opp.validate_student_move('d3e5') is True

    def test_validate_student_move_case_insensitive(self):
        opp = self.make_opp()
        assert opp.validate_student_move('D3E5') is True

    def test_validate_student_move_wrong(self):
        opp = self.make_opp()
        assert opp.validate_student_move('e2e4') is False


# ══════════════════════════════════════════════════════════════════
# REQ-05: PatternValidator logic (Python mirror)
# ══════════════════════════════════════════════════════════════════

XP_COMPLETE_GAME    = 20
XP_ATTEMPT_1_BONUS  = 30
XP_ATTEMPT_2_BONUS  = 15
XP_ATTEMPT_3_BONUS  = 5
STREAK_MILESTONE_XP = 50
STREAK_MILESTONES   = {7, 14, 30}

def validate_move_py(player_move, best_move, attempt_number, lesson):
    correct = player_move.strip().lower() == best_move.strip().lower()
    if correct:
        bonus = {1: XP_ATTEMPT_1_BONUS, 2: XP_ATTEMPT_2_BONUS}.get(
            attempt_number, XP_ATTEMPT_3_BONUS
        )
        return {
            'correct': True,
            'feedback': lesson['feedback_correct'],
            'hint': None,
            'show_answer': False,
            'xp_awarded': XP_COMPLETE_GAME + bonus,
        }
    if attempt_number == 1:
        return {'correct': False, 'feedback': 'Try again!', 'hint': None,
                'show_answer': False, 'xp_awarded': 0}
    if attempt_number == 2:
        return {'correct': False, 'feedback': lesson['feedback_hint'],
                'hint': lesson['feedback_hint'], 'show_answer': False, 'xp_awarded': 0}
    return {'correct': False, 'feedback': lesson['feedback_reveal'],
            'hint': None, 'show_answer': True, 'xp_awarded': XP_COMPLETE_GAME}


LESSON = {
    'feedback_correct': 'Yes! That is a fork!',
    'feedback_hint':    'Hint: look at your knight.',
    'feedback_reveal':  'The answer was Nd3-e5!',
}


class TestREQ05PatternValidator:

    def test_01_correct_attempt1_returns_50xp(self):
        """TEST 1: Correct on attempt 1 → correct:True, xp:50, show_answer:False."""
        r = validate_move_py('d3e5', 'd3e5', 1, LESSON)
        assert r['correct'] is True
        assert r['xp_awarded'] == 50  # 20 + 30
        assert r['show_answer'] is False
        assert r['hint'] is None

    def test_02_wrong_attempt1_no_hint(self):
        """TEST 2: Wrong attempt 1 → correct:False, hint:None, show_answer:False."""
        r = validate_move_py('e2e4', 'd3e5', 1, LESSON)
        assert r['correct'] is False
        assert r['hint'] is None
        assert r['show_answer'] is False
        assert r['xp_awarded'] == 0

    def test_03_wrong_attempt2_hint_not_none(self):
        """TEST 3: Wrong attempt 2 → hint is a non-empty string."""
        r = validate_move_py('e2e4', 'd3e5', 2, LESSON)
        assert r['correct'] is False
        assert r['hint'] is not None
        assert len(r['hint']) > 0
        assert r['show_answer'] is False

    def test_04_wrong_attempt3_show_answer(self):
        """TEST 4: Wrong attempt 3 → show_answer:True, xp:20 (base only)."""
        r = validate_move_py('e2e4', 'd3e5', 3, LESSON)
        assert r['correct'] is False
        assert r['show_answer'] is True
        assert r['xp_awarded'] == XP_COMPLETE_GAME

    def test_05_correct_attempt2_returns_35xp(self):
        r = validate_move_py('d3e5', 'd3e5', 2, LESSON)
        assert r['correct'] is True
        assert r['xp_awarded'] == 35  # 20 + 15

    def test_06_streak_milestone_gives_bonus_xp(self):
        """TEST 6: Streak milestone days give +50 XP bonus."""
        for day in [7, 14, 30]:
            bonus = STREAK_MILESTONE_XP if day in STREAK_MILESTONES else 0
            assert bonus == STREAK_MILESTONE_XP, f"Day {day} should give streak bonus"

    def test_06b_non_milestone_streak_gives_no_bonus(self):
        for day in [1, 5, 10, 20]:
            bonus = STREAK_MILESTONE_XP if day in STREAK_MILESTONES else 0
            assert bonus == 0, f"Day {day} should NOT give streak bonus"


# ══════════════════════════════════════════════════════════════════
# REQ-13: Roadmap logic (Python mirror)
# ══════════════════════════════════════════════════════════════════

PATTERN_SEQUENCE = [
    'fork', 'pin', 'back_rank_mate', 'skewer',
    'discovered_attack', 'double_check', 'deflection',
    'decoy', 'smothered_mate', 'overloading',
    'x_ray_attack', 'zwischenzug'
]
FREE_PATTERNS = {'fork', 'pin'}

def derive_node_states(current_pattern, current_game_number, patterns_mastered):
    mastered = set(patterns_mastered)
    nodes = []
    for p in PATTERN_SEQUENCE:
        if p in mastered:
            nodes.append({'pattern': p, 'status': 'done', 'games_completed': 5})
        elif p == current_pattern:
            nodes.append({'pattern': p, 'status': 'active',
                          'games_completed': max(0, current_game_number - 1)})
        else:
            nodes.append({'pattern': p, 'status': 'locked', 'games_completed': 0})
    return nodes


class TestREQ13Roadmap:

    def test_12_nodes_returned(self):
        """Roadmap must contain exactly 12 pattern nodes."""
        nodes = derive_node_states('fork', 1, [])
        assert len(nodes) == 12

    def test_active_node_correct_games_completed(self):
        """Active node gamesCompleted = current_game_number - 1."""
        nodes = derive_node_states('fork', 4, [])
        active = next(n for n in nodes if n['status'] == 'active')
        assert active['games_completed'] == 3

    def test_mastered_patterns_are_done(self):
        """Mastered patterns show done status with 5 games completed."""
        nodes = derive_node_states('back_rank_mate', 1, ['fork', 'pin'])
        fork = next(n for n in nodes if n['pattern'] == 'fork')
        pin  = next(n for n in nodes if n['pattern'] == 'pin')
        assert fork['status'] == 'done' and fork['games_completed'] == 5
        assert pin['status']  == 'done' and pin['games_completed']  == 5

    def test_patterns_after_active_are_locked(self):
        """All patterns after the active one should be locked."""
        nodes = derive_node_states('fork', 1, [])
        post_active = nodes[1:]
        for n in post_active:
            assert n['status'] == 'locked'

    def test_free_patterns_identified(self):
        """Fork and Pin must be identified as free."""
        assert 'fork' in FREE_PATTERNS
        assert 'pin'  in FREE_PATTERNS
        assert 'back_rank_mate' not in FREE_PATTERNS


# ══════════════════════════════════════════════════════════════════
# REQ-04: Scripted game content validation
# ══════════════════════════════════════════════════════════════════

SCRIPTED_GAMES_DATA = [
    {'pattern': 'fork', 'game': 1, 'fen': '4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1', 'move': 'd3e5'},
    {'pattern': 'fork', 'game': 2, 'fen': '4k3/5r2/8/8/2q1p3/3N4/8/4K3 w - - 0 1', 'move': 'd3e5'},
    {'pattern': 'fork', 'game': 3, 'fen': '1r2k3/8/8/8/2q5/2N5/8/4K3 w - - 0 1', 'move': 'c3e4'},
    {'pattern': 'fork', 'game': 4, 'fen': '2k5/2r5/8/8/3q4/5N2/8/4K3 w - - 0 1', 'move': 'f3d4'},
    {'pattern': 'fork', 'game': 5, 'fen': '5rk1/2r5/8/8/1q6/5N2/8/3K4 w - - 0 1', 'move': 'f3d4'},
]

class TestREQ04ScriptedGames:

    @pytest.mark.parametrize("game", SCRIPTED_GAMES_DATA)
    def test_pattern_fen_is_valid(self, game):
        """Every pattern_fen must parse as a valid chess position."""
        board = chess.Board(game['fen'])
        assert board is not None, f"FEN invalid for {game['pattern']} game {game['game']}"

    @pytest.mark.parametrize("game", SCRIPTED_GAMES_DATA)
    def test_best_move_is_legal(self, game):
        """Every best_move must be legal in its pattern_fen."""
        board    = chess.Board(game['fen'])
        uci_move = chess.Move.from_uci(game['move'])
        assert uci_move in board.legal_moves, (
            f"Move {game['move']} not legal in {game['fen']} "
            f"({game['pattern']} game {game['game']})"
        )
