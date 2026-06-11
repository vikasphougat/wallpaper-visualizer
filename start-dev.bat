@echo off
cd /d "%~dp0"
echo Working directory: %CD%
echo.
if not exist "index.html" (
  echo ERROR: index.html not found. Run this script from the wallpaper-visualizer folder.
  pause
  exit /b 1
)
if not exist "src\main.tsx" (
  echo ERROR: src\main.tsx not found.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo node_modules not found. Run install.bat first.
  pause
  exit /b 1
)
echo Starting Vite dev server...
npm run dev
