@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3020

powershell -Command "$enginePath = Join-Path $env:LOCALAPPDATA 'Programs\\VOICEVOX\\vv-engine\\run.exe'; if (Test-Path $enginePath) { $listening = @(Get-NetTCPConnection -State Listen -LocalPort 50021 -ErrorAction SilentlyContinue).Count -gt 0; if (-not $listening) { Start-Process -FilePath $enginePath -ArgumentList '--host','127.0.0.1','--port','50021','--cors_policy_mode','all','--output_log_utf8' -WindowStyle Minimized; $deadline = (Get-Date).AddSeconds(20); do { Start-Sleep -Milliseconds 400; try { $ready = (Invoke-WebRequest 'http://127.0.0.1:50021/version' -UseBasicParsing).StatusCode -eq 200 } catch { $ready = $false } } until ($ready -or (Get-Date) -gt $deadline) } }"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>nul
start "VRoid Mobile Web App Server" cmd /k "chcp 65001 >nul && cd /d %CD% && node server.js %PORT%"
powershell -Command "$deadline=(Get-Date).AddSeconds(15); do { Start-Sleep -Milliseconds 400; try { $ok=(Invoke-WebRequest 'http://localhost:%PORT%' -UseBasicParsing).StatusCode -eq 200 } catch { $ok=$false } } until ($ok -or (Get-Date) -gt $deadline); if (-not $ok) { exit 1 }"
if errorlevel 1 echo Web app did not become ready. & pause & exit /b 1
start "" http://localhost:%PORT%
