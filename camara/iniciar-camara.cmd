@echo off
chcp 65001 >nul
title Vision360 - Camara en vivo
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-camara.ps1"
echo.
pause
