@echo off
cd /d "%~dp0"
echo.
echo === Wallpaper Visualizer - Install ===
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  echo Install from https://nodejs.org/ then run this script again.
  pause
  exit /b 1
)

echo Node:
node -v
echo npm:
npm -v
echo.
echo Installing dependencies (including ML for auto-detect)...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed. See messages above.
  pause
  exit /b 1
)

echo.
echo === Install complete ===
echo.
echo Start the app with:
echo   npm run dev
echo.
pause
