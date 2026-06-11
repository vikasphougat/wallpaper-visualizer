@echo off
cd /d "%~dp0"
if not exist "node_modules\vite" (
  echo node_modules not found. Run install.bat first.
  pause
  exit /b 1
)
npm run dev
