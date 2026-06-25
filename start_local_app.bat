@echo off
setlocal
cd /d "%~dp0"
echo Starting Regional Potential Lab...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_local_app.ps1"
echo.
echo Regional Potential Lab has stopped. Press any key to close this window.
pause >nul
