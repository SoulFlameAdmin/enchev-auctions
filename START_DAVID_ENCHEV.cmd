@echo off
setlocal
set "REPO=D:\ASI\enchev-auctions"

where git >nul 2>nul || (
  echo [DAVID] Git ne e nameren. Instalirai Git for Windows i pusni otnovo.
  pause
  exit /b 1
)

where node >nul 2>nul || (
  echo [DAVID] Node.js ne e nameren. Instalirai Node.js LTS i pusni otnovo.
  pause
  exit /b 1
)

if not exist "%REPO%\.git" (
  echo [DAVID] Kloniram Enchev Auctions v %REPO% ...
  if not exist "D:\ASI" mkdir "D:\ASI"
  git clone https://github.com/SoulFlameAdmin/enchev-auctions.git "%REPO%" || goto :fail
) else (
  echo [DAVID] Obnovqvam repo-to...
  git -C "%REPO%" pull --ff-only || goto :fail
)

echo [DAVID] Startiram avtomatichna etapna rabota v fiksiranata ChatGPT sesiq...
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO%\tools\david\start-auto-continue.ps1" -Port 9444 -MaxTurns 2147483647
exit /b %ERRORLEVEL%

:fail
echo.
echo [DAVID] Startut spirа zaradi greshka. Proveri Git login/dostup i opitai pak.
pause
exit /b 1
