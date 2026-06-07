param([switch]$Refresh)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Refresh) {
    & (Join-Path $root "refresh.ps1")
}

$data = Join-Path $root "data\architecture-data.js"
if (-not (Test-Path $data)) { throw "architecture-data.js is missing." }

$wslRoot = "/mnt/" + $root.Substring(0, 1).ToLowerInvariant() + "/" + $root.Substring(3).Replace('\', '/')
wsl python3 ("$wslRoot/tools/test_analyze.py")
if ($LASTEXITCODE -ne 0) { throw "Analyzer unit tests failed." }

wsl python3 ("$wslRoot/tools/verify_analyzer.py")
if ($LASTEXITCODE -ne 0) { throw "Analyzer boundary verification failed." }

wsl python3 ("$wslRoot/tools/verify_harness.py")
if ($LASTEXITCODE -ne 0) { throw "Harness verification failed." }

wsl python3 ("$wslRoot/tools/verify_data.py") ("$wslRoot/data/architecture-data.js")
if ($LASTEXITCODE -ne 0) { throw "Data verification failed." }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    node --check (Join-Path $root "assets\app.js")
    if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed." }
}

Write-Host "Architecture Atlas verification passed."
