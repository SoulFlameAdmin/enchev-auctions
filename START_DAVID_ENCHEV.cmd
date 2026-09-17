@echo off
setlocal EnableExtensions

set "ROOT=D:\ASI"
set "REPO=%ROOT%\enchev-auctions"
set "PORTABLE_GIT=%ROOT%\tools\PortableGit\cmd\git.exe"
set "PORTABLE_NODE=%ROOT%\tools\node"
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if exist "%ROOT%\tools\PortableGit\cmd" set "PATH=%ROOT%\tools\PortableGit\cmd;%ROOT%\tools\PortableGit\bin;%PATH%"
if exist "%PORTABLE_NODE%" set "PATH=%PORTABLE_NODE%;%PATH%"

if exist "%PORTABLE_GIT%" (
  set "GIT_EXE=%PORTABLE_GIT%"
) else (
  where git >nul 2>nul || (
    echo [DAVID] Git is missing. Run BOOTSTRAP_DAVID_ENCHEV.ps1 first.
    pause
    exit /b 1
  )
  set "GIT_EXE=git"
)

where node >nul 2>nul || (
  echo [DAVID] Node.js is missing. Run BOOTSTRAP_DAVID_ENCHEV.ps1 first.
  pause
  exit /b 1
)

if not exist "%POWERSHELL_EXE%" (
  echo [DAVID] Windows PowerShell executable was not found at:
  echo %POWERSHELL_EXE%
  pause
  exit /b 1
)

if not exist "%REPO%\.git" (
  echo [DAVID] Repository not found at %REPO%.
  echo Run BOOTSTRAP_DAVID_ENCHEV.ps1 first.
  pause
  exit /b 1
)

echo [DAVID] Updating Enchev Auctions...
"%GIT_EXE%" -C "%REPO%" pull --ff-only || goto :fail

echo [DAVID] Starting automatic staged development in the fixed ChatGPT session...
"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%REPO%\tools\david\start-auto-continue.ps1" -Port 9444 -MaxTurns 2147483647
exit /b %ERRORLEVEL%

:fail
echo.
echo [DAVID] Start stopped because of an error.
pause
exit /b 1
