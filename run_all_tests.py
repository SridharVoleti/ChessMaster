#!/usr/bin/env python3
"""
ChessQuest — Master Test Runner
=================================
Runs all test suites and produces a combined pass/fail summary.

Usage:
    python run_all_tests.py
    python run_all_tests.py --ci        # Exit code 1 on any failure
    python run_all_tests.py --unit-only # Skip e2e tests
"""

import subprocess
import sys
import argparse
import time
from datetime import datetime


def run(label: str, cmd: list[str], cwd: str = '.') -> tuple[bool, str]:
    """Run a command and return (success, output)."""
    print(f'\n{"─"*60}')
    print(f'▶  {label}')
    print(f'{"─"*60}')
    start = time.time()
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    elapsed = time.time() - start
    output = result.stdout + result.stderr
    print(output)
    success = result.returncode == 0
    status = '✅ PASSED' if success else '❌ FAILED'
    print(f'{status} in {elapsed:.1f}s')
    return success, output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ci', action='store_true', help='Exit 1 on failure')
    parser.add_argument('--unit-only', action='store_true', help='Skip Cypress e2e')
    args = parser.parse_args()

    print(f'\n{"═"*60}')
    print(f'  ChessQuest Test Suite — {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'{"═"*60}')

    results: list[tuple[str, bool]] = []

    # ── Jest unit tests ────────────────────────────────────────────
    ok, _ = run(
        'REQ-03 + REQ-05 + REQ-13 — Jest unit tests (TypeScript)',
        ['npx', 'jest', '--no-coverage', '--verbose'],
        cwd='/home/claude/chessquest'
    )
    results.append(('Jest unit tests', ok))

    # ── Python tests ───────────────────────────────────────────────
    ok, _ = run(
        'REQ-01 + REQ-03 + REQ-04 + REQ-05 + REQ-13 — Python tests',
        ['python', '-m', 'pytest', 'tests/python/', '-v',
         '--html=tests/python/report.html', '--self-contained-html'],
        cwd='/home/claude/chessquest'
    )
    results.append(('Python tests', ok))

    # ── Cypress e2e ────────────────────────────────────────────────
    if not args.unit_only:
        ok, _ = run(
            'REQ-08 + REQ-10 + REQ-13 — Cypress e2e tests',
            ['npx', 'cypress', 'run', '--headless'],
            cwd='/home/claude/chessquest'
        )
        results.append(('Cypress e2e tests', ok))
    else:
        print('\n⏩ Skipping Cypress e2e (--unit-only)')

    # ── Summary ───────────────────────────────────────────────────
    print(f'\n{"═"*60}')
    print('  SUMMARY')
    print(f'{"═"*60}')

    all_passed = True
    for suite_name, passed in results:
        icon = '✅' if passed else '❌'
        print(f'  {icon}  {suite_name}')
        if not passed:
            all_passed = False

    total = len(results)
    passed_count = sum(1 for _, ok in results if ok)
    print(f'\n  {passed_count}/{total} suites passed')

    if all_passed:
        print('\n  🏆 ALL TESTS PASSED — ready to deploy\n')
    else:
        print('\n  ⚠️  SOME TESTS FAILED — fix before deploying\n')

    if args.ci and not all_passed:
        sys.exit(1)


if __name__ == '__main__':
    main()
