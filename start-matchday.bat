@echo off
cd /d "%~dp0web"
start "" /min cmd /c "ping -n 8 127.0.0.1 >nul & start "" http://localhost:3000"
npm run dev
