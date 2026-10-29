@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this computer.
  echo Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)
echo Starting HTML Tool Factory...
node src\server.js
if errorlevel 1 pause
