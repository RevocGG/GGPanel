@echo off
:: GGoose UI — Uninstall script (Windows)
:: Stops any running instance and removes all files.
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

echo.
echo ============================================================
echo   GGoose UI -- Uninstall
echo ============================================================
echo.
echo   [warn] This will stop and remove GGoose UI and all its data.
echo.
set /p "CONFIRM=  Are you sure you want to continue? [y/N]: "
if /i not "%CONFIRM%"=="y" (
  echo   Aborted.
  goto :eof
)

:: ── Kill any running node process started from this directory ─────────────
echo   Stopping any running GGoose UI process ...
taskkill /f /fi "WINDOWTITLE eq ggoose*" >nul 2>&1 || true
:: Try to kill node.exe processes that use server.js from this directory
for /f "tokens=2" %%P in ('wmic process where "name='node.exe'" get processid /value 2^>nul ^| findstr /r "[0-9]"') do (
  wmic process where "processid=%%P" get commandline 2>nul | findstr /i "%DIR%" >nul 2>&1
  if not errorlevel 1 taskkill /f /pid %%P >nul 2>&1
)
echo   [ok] Processes stopped (if any were running)

:: ── Remove data directory ─────────────────────────────────────────────────
if exist "%DIR%\data" (
  set /p "REMOVE_DATA=  Remove data directory (database, cores, configs)? [y/N]: "
  if /i "!REMOVE_DATA!"=="y" (
    rmdir /s /q "%DIR%\data"
    echo   [ok] Data directory removed
  ) else (
    echo   [warn] Data directory kept at %DIR%\data
  )
)

:: ── Remove .env ───────────────────────────────────────────────────────────
if exist "%DIR%\.env" (
  del /f /q "%DIR%\.env"
  echo   [ok] Removed .env
)

:: ── Remove the installation directory itself ──────────────────────────────
echo.
set /p "REMOVE_DIR=  Remove the entire installation directory (%DIR%)? [y/N]: "
if /i "!REMOVE_DIR!"=="y" (
  :: Schedule self-deletion (directory can't delete itself while bat is running)
  set "PARENT=%DIR%\.."
  echo   Scheduling removal of %DIR% ...
  start "" /b cmd /c "timeout /t 2 >nul & rmdir /s /q ""%DIR%"""
  echo.
  echo   [ok] GGoose UI has been completely uninstalled.
  echo   The installation folder will be removed momentarily.
) else (
  echo.
  echo   [ok] GGoose UI configuration removed. Files remain at %DIR%
)

echo.
pause
