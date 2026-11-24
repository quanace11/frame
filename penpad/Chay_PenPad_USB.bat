@echo off
chcp 65001 >nul
title PenPad (USB)
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 ( py -3 penpad_server.py %* ) else ( python penpad_server.py %* )
pause
