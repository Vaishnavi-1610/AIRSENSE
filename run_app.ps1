$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Starting AI Air Quality Prediction & Pollution Source Clustering" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 3

Write-Host "[2/2] Launching Frontend Vite Server on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\frontend'; npm run dev"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Both servers launched successfully!" -ForegroundColor Green
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor Green
Write-Host "Backend API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

