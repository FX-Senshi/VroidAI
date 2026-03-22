@echo off
chcp 65001 >nul
set PORT=3020
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>nul
echo VRoid AI server stopped.
timeout /t 2 >nul
