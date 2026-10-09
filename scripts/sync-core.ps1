param(
    [Parameter(Mandatory=$true)]
    [string]$SourcePath
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Nora Core Sync Tool - Updating Core Engine " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

if (-not (Test-Path $SourcePath)) {
    Write-Host "Error: Source path '$SourcePath' does not exist." -ForegroundColor Red
    exit 1
}

$coreTargets = @(
    "src/core",
    "src/components/ui",
    "src-tauri/src/commands",
    "src-tauri/capabilities",
    ".cursor/rules"
)

foreach ($target in $coreTargets) {
    $src = Join-Path $SourcePath $target
    $dest = Join-Path (Get-Location) $target

    if (Test-Path $src) {
        Write-Host "Syncing $target..." -ForegroundColor Yellow
        if (-not (Test-Path $dest)) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
        Copy-Item -Path "$src\*" -Destination $dest -Recurse -Force
    }
}

# Sync lib.rs without overwriting user custom app configs
$srcLib = Join-Path $SourcePath "src-tauri/src/lib.rs"
$destLib = Join-Path (Get-Location) "src-tauri/src/lib.rs"
if (Test-Path $srcLib) {
    Copy-Item -Path $srcLib -Destination $destLib -Force
    Write-Host "Synced src-tauri/src/lib.rs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[SUCCESS] Core files synchronized successfully!" -ForegroundColor Green
Write-Host "Note: src/app/ was completely untouched and preserved." -ForegroundColor Green
