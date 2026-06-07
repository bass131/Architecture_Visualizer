param(
    [string]$Source = "C:\Dev\ClaudeDev",
    [switch]$Open
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$output = Join-Path $root "data\architecture-data.js"
$config = Join-Path $root "config\analysis-config.json"
$analyzer = Join-Path $root "tools\analyze.py"

$sourcePath = (Resolve-Path $Source).Path.TrimEnd('\')
$projectPath = (Resolve-Path $root).Path.TrimEnd('\')
if ($projectPath.StartsWith($sourcePath + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
    $sourcePath.StartsWith($projectPath + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
    $sourcePath.Equals($projectPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Source and atlas project must be separate directories: $sourcePath"
}

function Convert-ToWslPath([string]$Path) {
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') {
        throw "Only local Windows drive paths are supported: $Path"
    }
    $drive = $Matches[1].ToLowerInvariant()
    $tail = $Matches[2].Replace('\', '/')
    return "/mnt/$drive/$tail"
}

Write-Host "[1/3] Checking WSL analyzer..."
$wslAnalyzer = Convert-ToWslPath $analyzer
wsl python3 -m py_compile $wslAnalyzer
if ($LASTEXITCODE -ne 0) { throw "Analyzer syntax check failed." }

Write-Host "[2/3] Analyzing $Source in WSL..."
$wslSource = Convert-ToWslPath $sourcePath
$wslOutput = Convert-ToWslPath $output
$wslConfig = Convert-ToWslPath $config
wsl python3 $wslAnalyzer --source $wslSource --output $wslOutput --config $wslConfig
if ($LASTEXITCODE -ne 0) { throw "Architecture analysis failed." }

if (-not (Test-Path $output) -or (Get-Item $output).Length -lt 100) {
    throw "Generated data is missing or unexpectedly small."
}

Write-Host "[3/3] Generated $output"
if ($Open) {
    Start-Process (Join-Path $root "_index.html")
}
