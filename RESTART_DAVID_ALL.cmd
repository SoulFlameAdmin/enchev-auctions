@echo off
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "SCRIPT=D:\ASI\enchev-auctions\RESTART_DAVID_ALL_CLEAN.ps1"

if not exist "%SCRIPT%" (
  echo [DAVID] Missing %SCRIPT%
  echo [DAVID] Run git pull once in D:\ASI\enchev-auctions.
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Port 9444
if errorlevel 1 (
  echo.
  echo [DAVID] Clean restart failed. See errors above.
  pause
  exit /b 1
)

echo.
echo [DAVID] Clean restart launched successfully.
timeout /t 2 /nobreak >nul
endlocal
