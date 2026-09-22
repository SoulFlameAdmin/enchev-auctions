param(
  [int]$Port = 9555,
  [int]$DavidPort = 9444
)
$ErrorActionPreference = "Stop"
$Root = if (Test-Path "D:\ASI") { "D:\ASI" } else { Join-Path $env:LOCALAPPDATA "DAVID" }
$Repo = Join-Path $Root "enchev-auctions"
$Here = Join-Path $Repo "tools\david"
$Worker = Join-Path $Here "sf-scientist-sidecar.mjs"
$ProfileDir = Join-Path $Root "SF_SCIENTIST_CHATGPT_PROFILE"
$StateFile = Join-Path $Here ".sf-scientist-state.json"
$PortableNode = "D:\ASI\tools\node"
if (Test-Path $PortableNode) { $env:Path = "$PortableNode;$env:Path" }

function Test-Cdp([int]$P) {
  try { $null = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2; return $true } catch { return $false }
}
function G([string]$Needle) {
  try { return @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -eq "node.exe" -and ([string]$_.CommandLine) -like ("*"+$Needle+"*") }) } catch { return @() }
}
function Get-BrowserPath {
  $c = New-Object System.Collections.Generic.List[string]
  $pf86=[Environment]::GetFolderPath("ProgramFilesX86")
  $pf=[Environment]::GetFolderPath("ProgramFiles")
  if ($pf86) { $c.Add((Join-Path $pf86 "Microsoft\Edge\Application\msedge.exe")); $c.Add((Join-Path $pf86 "Google\Chrome\Application\chrome.exe")) }
  if ($pf) { $c.Add((Join-Path $pf "Microsoft\Edge\Application\msedge.exe")); $c.Add((Join-Path $pf "Google\Chrome\Application\chrome.exe")) }
  if ($env:LOCALAPPDATA) { $c.Add((Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")); $c.Add((Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")) }
  foreach ($n in @("msedge.exe","msedge","chrome.exe","chrome")) { $x=Get-Command $n -ErrorAction SilentlyContinue; if($x -and $x.Source){$c.Add($x.Source)} }
  foreach ($x in ($c|Select-Object -Unique)) { if($x -and (Test-Path $x)){return $x} }
  return $null
}
if (-not (Test-Path $Worker)) { throw "Missing SF Scientist worker: $Worker" }
$existing=@(G "sf-scientist-sidecar.mjs")
if($existing.Count -gt 1){throw "Duplicate SF Scientist workers detected."}
if($existing.Count -eq 1 -and (Test-Cdp $Port)){Write-Host "[SF SCIENTIST] Already online // worker=1 // CDP $Port ONLINE" -ForegroundColor Green;exit 0}
if($existing.Count -eq 1){throw "SF Scientist worker exists but CDP $Port is offline. Stop Scientist and start again."}
if(-not(Test-Cdp $Port)){
  $browser=Get-BrowserPath
  if(-not$browser){throw "No Edge/Chrome browser found for SF Scientist."}
  New-Item -ItemType Directory -Force -Path $ProfileDir|Out-Null
  Start-Process -FilePath $browser -ArgumentList @("--remote-debugging-address=127.0.0.1","--remote-debugging-port=$Port","--user-data-dir=$ProfileDir","--no-first-run","--no-default-browser-check","--disable-session-crashed-bubble","--disable-features=msEdgeRestoreOnStartup","--new-window","https://chatgpt.com/")
  $ok=$false;for($i=0;$i-lt 50;$i++){Start-Sleep -Milliseconds 500;if(Test-Cdp $Port){$ok=$true;break}}
  if(-not$ok){throw "SF Scientist browser started but CDP $Port did not become ready."}
}
$node=Get-Command node -ErrorAction SilentlyContinue
$npm=Get-Command npm.cmd -ErrorAction SilentlyContinue;if(-not$npm){$npm=Get-Command npm -ErrorAction SilentlyContinue}
if(-not$node){throw "Node.js not found."};if(-not$npm){throw "npm not found."}
Push-Location $Here
try{
  if(-not(Test-Path(Join-Path $Here "node_modules\playwright-core"))){& $npm.Source install;if($LASTEXITCODE-ne 0){throw "npm install failed"}}
  $env:SF_SCIENTIST_CDP_URL="http://127.0.0.1:$Port"
  $env:DAVID_CDP_URL="http://127.0.0.1:$DavidPort"
  Start-Process -FilePath $node.Source -ArgumentList @($Worker) -WorkingDirectory $Here -WindowStyle Hidden
}finally{Pop-Location}
$healthy=$false
for($i=0;$i-lt 120;$i++){
  Start-Sleep -Milliseconds 500
  if(@(G "sf-scientist-sidecar.mjs").Count-eq 1-and(Test-Cdp $Port)-and(Test-Path $StateFile)){
    try{$s=Get-Content -Raw $StateFile|ConvertFrom-Json;if($s.status-in@("online","starting","login-required","thinking")){$healthy=$true;break}}catch{}
  }
}
if(-not$healthy){throw "SF Scientist failed startup health gate."}
Write-Host "[SF SCIENTIST] ONLINE // sidecar=1 // Scientist CDP=$Port // DAVID observed at CDP=$DavidPort" -ForegroundColor Green
Write-Host "[SF SCIENTIST] Existing DAVID architecture was not modified." -ForegroundColor DarkGreen
