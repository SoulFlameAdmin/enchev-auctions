@echo off
setlocal EnableExtensions
set "REPO=D:\ASI\enchev-auctions"

where winget >nul 2>nul || (
  echo [DAVID] Winget ne e nameren. Instalirai App Installer ot Microsoft Store i pusni otnovo.
  pause
  exit /b 1
)

where git >nul 2>nul || (
  echo [DAVID] Instaliram Git for Windows...
  winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements || goto :fail
  set "PATH=%PATH%;C:\Program Files\Git\cmd"
)

where node >nul 2>nul || (
  echo [DAVID] Instaliram Node.js LTS...
  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements || goto :fail
  set "PATH=%PATH%;C:\Program Files\nodejs"
)

where git >nul 2>nul || (
  echo [DAVID] Git e instaliran, no PATH oshte ne e opresnen. Zatvori prozoreca i pusni START_DAVID_ENCHEV.cmd pak.
  pause
  exit /b 1
)

where node >nul 2>nul || (
  echo [DAVID] Node e instaliran, no PATH oshte ne e opresnen. Zatvori prozoreca i pusni START_DAVID_ENCHEV.cmd pak.
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
echo [DAVID] Startut spira zaradi greshka. Ako GitHub iska login, vlezi v prozoreca na Git Credential Manager i opitai pak.
pause
exit /b 1
