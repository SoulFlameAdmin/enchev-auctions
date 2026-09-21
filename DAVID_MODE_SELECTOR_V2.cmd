@echo off
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
start "" "%PS%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\ASI\enchev-auctions\DAVID_MODE_SELECTOR_V2.ps1"
exit /b 0
