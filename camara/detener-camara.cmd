@echo off
chcp 65001 >nul
title Vision360 - Detener camara
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0detener-camara.ps1"

pause
