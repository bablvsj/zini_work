@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WorkTracker - 工作追踪看板

echo.
echo  ============================================
echo    WorkTracker 工作追踪看板
echo  ============================================
echo.
echo  正在启动本地服务...
echo  浏览器会自动打开，请勿关闭此窗口。
echo  关闭此窗口即可停止服务。
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [错误] 未找到 Node.js，请先安装: https://nodejs.org
  echo.
  pause
  exit /b 1
)

node server.js
pause
