param(
  [int]$Port = 9444,
  [int]$MaxTurns = 2147483647
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = "D:\ASI"
$Tools = Join-Path $Root "tools"
$Repo = Join-Path $Root "enchev-auctions"
$GitHome = Join-Path $Tools "PortableGit"
$NodeHome = Join-Path $Tools "node"
$ChatUrl = "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"

function Say([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Cyan) {
  Write-Host $Text -ForegroundColor $Color
}

function Ensure-Dir([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Refresh-Path {
  $parts = @(
    (Join-Path $GitHome "cmd"),
    (Join-Path $GitHome "bin"),
    $NodeHome,
    $env:Path
  )
  $env:Path = ($parts -join ";")
}

Ensure-Dir $Root
Ensure-Dir $Tools
Refresh-Path

Say "`n=== DAVID ENCHEV BOOTSTRAP ===" Green

# 1) Portable Git (no winget/admin required)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Say "[1/6] Няма Git. Свалям PortableGit без инсталация..." Yellow
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -Headers @{"User-Agent"="DAVID-Enchev-Bootstrap"}
  $asset = $release.assets | Where-Object { $_.name -match '^PortableGit-.*-64-bit\.7z\.exe$' } | Select-Object -First 1
  if (-not $asset) { throw "Не намерих 64-bit PortableGit asset в последния Git for Windows release." }
  $gitArchive = Join-Path $Tools $asset.name
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $gitArchive -UseBasicParsing
  if (Test-Path $GitHome) { Remove-Item $GitHome -Recurse -Force }
  Ensure-Dir $GitHome
  & $gitArchive -y -o"$GitHome" | Out-Null
  Remove-Item $gitArchive -Force -ErrorAction SilentlyContinue
  Refresh-Path
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git не стартира след PortableGit bootstrap." }
Say ("[OK] " + (& git --version)) Green

# 2) Portable Node.js LTS (no winget/admin required)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say "[2/6] Няма Node.js. Свалям последния Node LTS ZIP..." Yellow
  $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
  $lts = $index | Where-Object { $_.lts -and ($_.files -contains 'win-x64-zip') } | Select-Object -First 1
  if (-not $lts) { throw "Не намерих Node.js LTS win-x64-zip." }
  $ver = $lts.version
  $zip = Join-Path $Tools "node-$ver-win-x64.zip"
  $url = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  $extract = Join-Path $Tools "node-extract"
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $folder = Get-ChildItem $extract -Directory | Select-Object -First 1
  if (-not $folder) { throw "Node ZIP няма очакваната папка." }
  if (Test-Path $NodeHome) { Remove-Item $NodeHome -Recurse -Force }
  Move-Item $folder.FullName $NodeHome
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Refresh-Path
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js не стартира след bootstrap." }
Say ("[OK] Node " + (& node --version)) Green
Say ("[OK] npm " + (& npm --version)) Green

# 3) Get/update private repository
if (Test-Path (Join-Path $Repo ".git")) {
  Say "[3/6] Обновявам Enchev Auctions..." Yellow
  & git -C $Repo pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "git pull се провали." }
} elseif (Test-Path $Repo) {
  $items = @(Get-ChildItem -Force $Repo -ErrorAction SilentlyContinue)
  if ($items.Count -eq 0) {
    Remove-Item $Repo -Force
  } else {
    throw "$Repo съществува, но не е Git repo. Не го трия автоматично." 
  }
}

if (-not (Test-Path (Join-Path $Repo ".git"))) {
  Say "[3/6] Клонирам private repo. Ако GitHub поиска вход, завърши browser login-а..." Yellow
  & git clone "https://github.com/SoulFlameAdmin/enchev-auctions.git" $Repo
  if ($LASTEXITCODE -ne 0) {
    throw "git clone се провали. Ако е заради login, влез в GitHub прозореца и пусни bootstrap-а пак. Не поставяй token в този скрипт."
  }
}

# 4) Verify DAVID files
$starter = Join-Path $Repo "tools\david\start-auto-continue.ps1"
if (-not (Test-Path $starter)) { throw "DAVID starter липсва: $starter" }
Say "[4/6] DAVID файловете са налични." Green

# 5) Show fixed target
Say "[5/6] ChatGPT сесия: $ChatUrl" Green
Say "      DAVID ще работи по Master Plan/WAVE последователно и ще спира на [[DAVID_STOP]]." DarkGray

# 6) Start worker
Say "[6/6] Стартирам DAVID..." Green
& $starter -Port $Port -MaxTurns $MaxTurns
