@echo off
REM ─────────────────────────────────────────────────────────────────
REM ChessQuest — local dev launcher
REM Usage:   start-game.bat [port]
REM Default port 3000; if it is already in use (e.g. another dev
REM server), falls back to 3100 automatically.
REM ─────────────────────────────────────────────────────────────────

setlocal
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=3000

REM Fall back if the chosen port is already listening
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo Port %PORT% is already in use - starting ChessQuest on 3100 instead.
    set PORT=3100
)

REM First run: install dependencies
if not exist node_modules (
    echo Installing dependencies - first run only...
    call npm install
)

echo.
echo ===============================================================
echo  ChessQuest starting on   http://localhost:%PORT%
echo.
echo  Test URLs:
echo    Level 1  http://localhost:%PORT%/play/fork
echo    Level 2  http://localhost:%PORT%/play/pin
echo    Level 3  http://localhost:%PORT%/play/back_rank_mate
echo    Level 4  http://localhost:%PORT%/play/skewer
echo    Level 5  http://localhost:%PORT%/play/discovered_attack
echo.
echo  Tips:  add ?game=6     to jump straight to the Main Game
echo         add ?delay=200  to fast-forward the scripted intro
echo         (combine them:  ?game=6^&delay=200)
echo.
echo  Press Ctrl+C to stop the server.
echo ===============================================================
echo.

REM Open the browser once the server has had a moment to boot
start "" powershell -NoProfile -Command "Start-Sleep 6; Start-Process 'http://localhost:%PORT%/play/fork'"

call npm run dev -- -p %PORT%
endlocal
