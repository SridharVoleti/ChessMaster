"""Ad-hoc runner: search pattern setups from base openings.

Usage: python -m chess_pipeline.search_runner <pattern> <student> "<base SAN>" [extra_plies] [allow_captures]
"""

import sys

from chess_pipeline.design_tools import find_pattern_setups, describe


def main():
    pattern, student, base = sys.argv[1], sys.argv[2], sys.argv[3]
    extra = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    caps = len(sys.argv) > 5 and sys.argv[5] == "caps"
    setups = find_pattern_setups(base, pattern, student,
                                 max_extra_plies=extra, allow_captures=caps)
    print(describe(setups, top=8))


if __name__ == "__main__":
    main()
