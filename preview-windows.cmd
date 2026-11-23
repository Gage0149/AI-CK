@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto python
py -3 preview.py
goto done
:python
python preview.py
:done
pause
