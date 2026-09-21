param([int]$Port=9444)
$ErrorActionPreference="Stop"
$Repo="D:\ASI\enchev-auctions"
$Master=Join-Path $Repo "DAVID_MATRIX_START.ps1"
if(-not(Test-Path $Master)){throw "Missing DAVID Matrix master: $Master"}
& $Master -Port $Port
if($LASTEXITCODE-ne 0){exit $LASTEXITCODE}
