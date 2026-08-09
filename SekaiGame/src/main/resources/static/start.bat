@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Nightcord Duel Network v1.4.0

echo ============================================
echo   Nightcord Duel Network v1.4.0
echo ============================================
echo.

rem 关闭仍占用端口的旧服务器
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo 正在关闭旧服务器 PID %%P ...
    taskkill /PID %%P /F >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8079" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

where node >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在启动游戏服务器 (端口 8080)...
    start "" /b node scripts\server.mjs
    echo 正在启动PvP服务器 (端口 8079)...
    start "" /b node scripts\pvp-server.mjs
    timeout /t 2 >nul
    start "" /b "%~dp0scripts\open-browser.bat"
    echo 服务器已启动！
    echo   游戏: http://127.0.0.1:8080
    echo   PvP:  ws://127.0.0.1:8079
    echo.
    echo 按 Ctrl+C 停止服务器
    pause
    goto :end
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在使用 Python 启动...
    start "" /b "%~dp0scripts\open-browser.bat"
    python -m http.server 8080 --bind 127.0.0.1
    goto :end
)

echo 未检测到 Node.js 或 Python。
echo 推荐安装 Node.js 18 或更高版本。
pause

:end
