@echo off
chcp 65001 >nul
title Tesu Trader Launcher

echo ============================================================
echo   Tesu Trader - Cleaning Ports and Starting Engine...
echo ============================================================

:: Kill any stray node/vite on 3000 if exists
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Start python engine minimized
start "Tesu Trading Engine" /min python engine\main.py

timeout /t 2 /nobreak >nul

echo Starting Nora / Tauri Interface...
npm run tauri dev
pause
