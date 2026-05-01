@echo off
title GGoose Panel
cd /d "%~dp0app"
if not exist "data" mkdir data
if not exist "data\cores" mkdir data\cores
if not exist ".env" (
  echo [GGoose] First run detected - running setup...
  node.exe scripts\install.bat
)
echo [GGoose] Starting GGoose Panel...
echo [GGoose] Open your browser at http://localhost:3000
node.exe launcher.js
pause
