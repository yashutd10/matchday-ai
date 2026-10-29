@echo off
cd /d "%~dp0web"
start "" cmd /c "timeout /t 6 >nul && start http://localhost:3000"
npm run dev
