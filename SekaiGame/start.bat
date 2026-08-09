@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Nightcord Duel Network - Spring Boot

echo ============================================
echo   Nightcord Duel Network
echo   Spring Boot Server
echo ============================================
echo.

rem 关闭占用8091端口的旧进程
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8091" ^| findstr "LISTENING"') do (
    echo 关闭旧服务器 PID %%P ...
    taskkill /PID %%P /F >nul 2>&1
)

echo 检查 Maven...
where mvn >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到 Maven，请先安装 Maven
    echo 下载地址: https://maven.apache.org/download.cgi
    pause
    exit /b 1
)

echo 检查 Java...
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到 Java，请先安装 JDK 17+
    pause
    exit /b 1
)

echo.
echo 编译项目...
call mvn clean package -DskipTests
if %errorlevel% neq 0 (
    echo 编译失败！
    pause
    exit /b 1
)

echo.
echo 启动服务器...
echo   游戏: http://127.0.0.1:8091
echo   登录: http://127.0.0.1:8091/login
echo   注册: http://127.0.0.1:8091/register
echo   API:  http://127.0.0.1:8091/api
echo   PvP:  ws://127.0.0.1:8091/ws/pvp
echo.
echo 按 Ctrl+C 停止服务器
echo.

set JAVA_HOME=C:\Program Files\Java\latest\jdk-21
"%JAVA_HOME%\bin\java.exe" -jar target\sekai-game-1.0.0.jar

pause
