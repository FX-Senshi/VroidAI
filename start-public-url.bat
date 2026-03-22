@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3020
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>nul
start "VRoid Mobile Web App Server" cmd /k "chcp 65001 >nul && cd /d %CD% && node server.js %PORT%"
powershell -Command "$deadline=(Get-Date).AddSeconds(15); do { Start-Sleep -Milliseconds 400; try { $ok=(Invoke-WebRequest 'http://localhost:%PORT%' -UseBasicParsing).StatusCode -eq 200 } catch { $ok=$false } } until ($ok -or (Get-Date) -gt $deadline); if (-not $ok) { exit 1 }"
if errorlevel 1 echo Local server did not become ready. & pause & exit /b 1
echo Creating public URL...
call npx.cmd --yes --cache .npm-cache localtunnel --port %PORT%
