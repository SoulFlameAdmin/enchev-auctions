@echo off
setlocal EnableExtensions
set "REPO=D:\ASI\enchev-auctions"
set "NODE=D:\ASI\tools\node\node.exe"
set "GIT=D:\ASI\tools\PortableGit\cmd\git.exe"

if exist "%GIT%" (
  "%GIT%" -C "%REPO%" pull --ff-only >nul 2>nul
)

if not exist "%NODE%" (
  where node >nul 2>nul || exit /b 1
  set "NODE=node"
)

cd /d "%REPO%\tools\david"
"%NODE%" worker-control.mjs
