@echo off
REM ===========================================================================
REM  PromptForge AI - Windows build launcher
REM  All the real work happens in scripts\build-win.mjs (full logging, safe
REM  error handling, and it waits for a keypress so nothing vanishes).
REM  Requires Node.js 22.12 or newer from https://nodejs.org
REM ===========================================================================
cd /d "%~dp0"
title PromptForge AI - Build

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found.
  echo   Install the LTS version from https://nodejs.org
  echo   Keep "Add to PATH" checked during setup, then reboot and try again.
  echo.
  pause
  exit /b 1
)

node "scripts\build-win.mjs"
set "CODE=%ERRORLEVEL%"

echo.
if not "%CODE%"=="0" (
  echo   Build exited with code %CODE%. See build-log.txt for the full output.
) else (
  echo   Done. Your .exe files are in the "release" folder.
)
echo.
pause
exit /b %CODE%
