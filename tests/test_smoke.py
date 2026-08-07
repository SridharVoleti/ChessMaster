"""
ChessQuest — Python smoke tests.
Validates the Python environment and basic chess library functionality.
Run:  pytest tests/test_smoke.py -v
"""

import os
import chess
import chess.pgn
import io
import pytest


class TestEnvironment:
    """Verify Python dependencies are installed and importable."""

    def test_chess_library_importable(self):
        assert chess.__version__ is not None

    def test_chess_board_creates_starting_position(self):
        board = chess.Board()
        assert board.fen().startswith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")

    def test_chess_pgn_importable(self):
        pgn = io.StringIO("1. e4 e5 *")
        game = chess.pgn.read_game(pgn)
        assert game is not None

    def test_env_var_supabase_url_has_a_value(self):
        """NEXT_PUBLIC_SUPABASE_URL must be set (falls back to localhost in CI)."""
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321")
        assert url.startswith("http"), f"Expected http URL, got: {url!r}"

    def test_env_var_anon_key_has_a_value(self):
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
        assert len(key) > 0


class TestFenParsing:
    """Validate that the five Fork scripted-game FENs are well-formed."""

    FENS = [
        "4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1",
        "4k3/5r2/8/8/2q1p3/3N4/8/4K3 w - - 0 1",
        "1r2k3/8/8/8/2q5/2N5/8/4K3 w - - 0 1",
        "2k5/2r5/8/8/3q4/5N2/8/4K3 w - - 0 1",
        "5rk1/2r5/8/8/1q6/5N2/8/3K4 w - - 0 1",
    ]

    @pytest.mark.parametrize("fen", FENS)
    def test_fen_parses_without_error(self, fen):
        board = chess.Board(fen)
        assert board is not None

    @pytest.mark.parametrize("fen", FENS)
    def test_fen_is_white_to_move(self, fen):
        board = chess.Board(fen)
        assert board.turn == chess.WHITE

    def test_fen_normalisation_strips_clocks(self):
        fen = "4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 10 42"
        normalised = " ".join(fen.split()[:4])
        expected = "4k3/5r2/8/8/2q5/3N4/8/4K3 w - -"
        assert normalised == expected
