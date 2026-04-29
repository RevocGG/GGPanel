@echo off
:: GGoose UI — First-time setup for the offline release bundle (Windows)
:: Run this once after extracting the release zip.
:: Does NOT require Node.js installed system-wide.
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

echo.
echo ============================================================
echo   GGoose UI -- Setup
echo ============================================================
echo.

:: ── Check for existing .env ──────────────────────────────────────────────
if exist "%DIR%\.env" (
  echo   [warn] .env already exists. Delete it and re-run to reconfigure.
  echo.
  goto :init_db
)

:: ── Admin username ───────────────────────────────────────────────────────
set /p "ADMIN_USERNAME=  Admin username [admin]: "
if "%ADMIN_USERNAME%"=="" set "ADMIN_USERNAME=admin"

:: ── Admin password (no confirmation on Windows cmd — use a strong one) ───
echo.
echo   NOTE: Password will be visible as you type (Windows limitation).
echo.
set /p "ADMIN_PASSWORD=  Admin password: "
if "%ADMIN_PASSWORD%"=="" (
  echo   [error] Password cannot be empty.
  pause
  exit /b 1
)

:: ── Port ────────────────────────────────────────────────────────────────
set /p "PORT=  Port [3000]: "
if "%PORT%"=="" set "PORT=3000"

:: ── Generate random AUTH_SECRET ─────────────────────────────────────────
:: Uses PowerShell which is always available on Win 7+
for /f %%i in ('powershell -NoProfile -Command "[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','').ToLower()"') do set "AUTH_SECRET=%%i"

:: ── Write .env ──────────────────────────────────────────────────────────
(
  echo ADMIN_USERNAME=%ADMIN_USERNAME%
  echo ADMIN_PASSWORD=%ADMIN_PASSWORD%
  echo AUTH_SECRET=%AUTH_SECRET%  echo COOKIE_SECURE=false  echo PORT=%PORT%
  echo HOSTNAME=0.0.0.0
  echo DATABASE_URL=file:%DIR%\data\goose.db
  echo CORES_DIR=%DIR%\data\cores
  echo NODE_ENV=production
) > "%DIR%\.env"

echo   [ok] Created .env

:init_db
:: ── Load .env ────────────────────────────────────────────────────────────
for /f "usebackq tokens=1,* delims==" %%A in ("%DIR%\.env") do (
  set "LINE=%%A"
  if not "!LINE!"=="" if not "!LINE:~0,1!"=="#" set "%%A=%%B"
)

:: ── Create directories ───────────────────────────────────────────────────
if not exist "%DIR%\data\cores"   mkdir "%DIR%\data\cores"
if not exist "%DIR%\data\configs" mkdir "%DIR%\data\configs"
echo   [ok] Directories ready

:: ── Initialize database ──────────────────────────────────────────────────
"%DIR%\node.exe" "%DIR%\setup.js"
if errorlevel 1 (
  echo   [error] Database initialization failed.
  pause
  exit /b 1
)
echo   [ok] Database initialized

echo.
echo ============================================================
echo   Setup complete!
echo.
echo   1. Drop the goose-client.exe binary (or Linux binary via WSL)
echo      into:   %DIR%\data\cores\
echo.
echo   2. Start GGoose UI:
echo      Double-click start.bat
echo      or run:  start.bat
echo.
echo   3. Open in browser:
echo      http://localhost:%PORT%
echo ============================================================
echo.
pause
