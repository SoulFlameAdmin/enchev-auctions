param()

$ErrorActionPreference = "Stop"
$Repo = "D:\ASI\enchev-auctions"
$Runner = Join-Path $Repo "tools\david\run-worker-control.cmd"
$Launcher = Join-Path $Repo "tools\david\launch-worker-control.vbs"

if (-not (Test-Path $Runner)) {
  throw "Missing DAVID runner: $Runner"
}

$launcherText = @'
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd.exe /c ""D:\ASI\enchev-auctions\tools\david\run-worker-control.cmd""", 0, False
'@
Set-Content -Path $Launcher -Value $launcherText -Encoding ASCII

$startup = [Environment]::GetFolderPath("Startup")
$startupVbs = Join-Path $startup "DAVID_Enchev_Worker.vbs"
Copy-Item $Launcher $startupVbs -Force

$base = "HKCU:\Software\Classes\david-enchev"
New-Item -Path $base -Force | Out-Null
Set-Item -Path $base -Value "URL:DAVID Enchev Worker"
New-ItemProperty -Path $base -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
$commandKey = Join-Path $base "shell\open\command"
New-Item -Path $commandKey -Force | Out-Null
$command = 'wscript.exe "D:\ASI\enchev-auctions\tools\david\launch-worker-control.vbs" "%1"'
Set-Item -Path $commandKey -Value $command

Write-Host "[DAVID] Autostart installed." -ForegroundColor Green
Write-Host "[DAVID] Custom protocol installed: david-enchev://start" -ForegroundColor Green
Write-Host "[DAVID] Starting local control bridge now..." -ForegroundColor Cyan
Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $Launcher + '"')
Write-Host "[DAVID] Done. Open Enchev Auctions > Etapi and use the AI WORKER button." -ForegroundColor Green
