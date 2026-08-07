"""
Shared pytest fixtures for ChessQuest test suite.
All fixtures are data-driven and reusable across test modules.
"""
import os
import pytest


@pytest.fixture(scope="session")
def supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321")


@pytest.fixture(scope="session")
def supabase_anon_key() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")


@pytest.fixture(scope="session")
def supabase_service_key() -> str:
    return os.getenv("SUPABASE_SERVICE_KEY", "test-service-key")


@pytest.fixture
def fork_pattern_fen() -> str:
    return "4k3/5r2/8/8/2q5/3N4/8/4K3 w - - 0 1"


@pytest.fixture
def fork_best_move() -> str:
    return "d3e5"


@pytest.fixture
def sample_lesson() -> dict:
    return {
        "feedback_correct": "Yes! That is a fork!",
        "feedback_hint": "Hint: look at your knight.",
        "feedback_reveal": "The answer was Nd3-e5!",
    }


@pytest.fixture
def scripted_moves() -> list[str]:
    return ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"]
