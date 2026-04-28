@echo off
:: GGoose UI — Launcher (Windows)
:: Place this file next to server.js in the release bundle.
setlocal enabledelayedexpansion

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

:: ── Load .env ──────────────────────────────────────────────────────────
if exist "%DIR%\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%DIR%\.env") do (
    set "LINE=%%A"
    if not "!LINE!"=="" if not "!LINE:~0,1!"=="#" (
      set "%%A=%%B"
    )
  )
)

:: ── Validate required config ──────────────────────────────────────────
if "%ADMIN_USERNAME%"=="" (
  echo.
  echo   ERROR: ADMIN_USERNAME and ADMIN_PASSWORD are not set.
  echo   Run install.bat for first-time interactive setup.
  echo.
  pause
  exit /b 1
)

:: ── Defaults ──────────────────────────────────────────────────────────
if "%PORT%"==""         set "PORT=3000"
if "%HOSTNAME%"==""     set "HOSTNAME=0.0.0.0"
if "%DATABASE_URL%"=="" set "DATABASE_URL=file:%DIR%\data\goose.db"
if "%CORES_DIR%"==""    set "CORES_DIR=%DIR%\data\cores"
if "%AUTH_SECRET%"==""  set "AUTH_SECRET=fallback-secret-please-change"

:: ── Ensure directories and initialize DB ──────────────────────────────
if not exist "%DIR%\data\cores"   mkdir "%DIR%\data\cores"
if not exist "%DIR%\data\configs" mkdir "%DIR%\data\configs"

"%DIR%\node.exe" "%DIR%\setup.js"
if errorlevel 1 (
  echo [ERROR] Database initialization failed.
  pause
  exit /b 1
)

:: ── Start server ──────────────────────────────────────────────────────
echo [ggoose] Starting on http://%HOSTNAME%:%PORT%
cd /d "%DIR%"
"%DIR%\node.exe" server.js
