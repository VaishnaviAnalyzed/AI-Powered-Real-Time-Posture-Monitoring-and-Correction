@echo off
title Posture Pal Launcher
color 0A

echo ==================================================
echo         STARTING POSTURE PAL ENVIRONMENT
echo ==================================================
echo.

echo [1/2] Starting Backend Server (FastAPI)...
if not exist "%~dp0server\venv" (
    echo Virtual environment not found. Creating and installing backend dependencies...
    cmd /c "cd /d "%~dp0server" && python -m venv venv && .\venv\Scripts\activate && pip install -r requirements.txt"
)
start "Posture Pal Backend" cmd /k "cd /d "%~dp0server" && .\venv\Scripts\activate && uvicorn app:app --port 8000"

echo [2/2] Starting Frontend Server (Vite + React)...
if not exist "%~dp0client\node_modules" (
    echo Frontend dependencies not found. Installing...
    cmd /c "cd /d "%~dp0client" && npm install"
)
start "Posture Pal Frontend" cmd /k "cd /d "%~dp0client" && npm run dev -- --open"

echo.
echo ==================================================
echo Both servers have been launched in separate windows!
echo.
echo Frontend URL: http://localhost:5173
echo Backend URL:  http://127.0.0.1:8000
echo ==================================================
echo.
pause
