@echo off
setlocal
echo ======================================================================
echo Starting AI Air Quality Prediction ^& Pollution Source Clustering
echo ======================================================================
echo.

set "SCRIPT_DIR=%~dp0"

echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "AirSense Backend (FastAPI)" cmd /k "cd /d "%SCRIPT_DIR%backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak > nul

echo [2/2] Launching Frontend Vite Server on http://localhost:5173 ...
start "AirSense Frontend (Vite/React)" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm run dev"

echo.
echo ======================================================================
echo Both servers started!
echo Open your browser at: http://localhost:5173
echo Backend API Docs at: http://127.0.0.1:8000/docs
echo ======================================================================

