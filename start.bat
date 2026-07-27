@echo off
TITLE CRAVE Application Launcher
cls
echo ===================================================
echo             Starting CRAVE Application            
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"

echo [1/2] Starting CRAVE Backend Server...
start "CRAVE Backend Server" cmd /k "cd /d "%ROOT_DIR%server" && (if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (echo Warning: Virtual environment venv not found, using system Python...)) && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting CRAVE Frontend Client...
start "CRAVE Frontend Client" cmd /k "cd /d "%ROOT_DIR%client" && npm run dev"

echo.
echo ===================================================
echo  Both Server and Client have been launched!  
echo.
echo  Backend API:  http://localhost:8000
echo  Frontend UI:  http://localhost:5173
echo ===================================================
echo.
pause
