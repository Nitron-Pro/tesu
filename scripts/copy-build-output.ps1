# Copy compiled artifacts to build_output
$OutputDir = "build_output"
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$releaseDir = "src-tauri\target\release"
$nsisDir = "$releaseDir\bundle\nsis"
$msiDir = "$releaseDir\bundle\msi"

# 1. Copy NSIS Setup
$setupExe = Get-ChildItem -Path $nsisDir -Filter "*setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setupExe) {
    Copy-Item $setupExe.FullName -Destination "$OutputDir\Tesu_Trader_1.1.0_Setup.exe" -Force
    Copy-Item $setupExe.FullName -Destination "$OutputDir\Tesu_Trader_Setup.exe" -Force
    Write-Host "Copied NSIS installer -> $OutputDir\Tesu_Trader_1.1.0_Setup.exe"
}

# 2. Copy MSI Installer
$msiFile = Get-ChildItem -Path $msiDir -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msiFile) {
    Copy-Item $msiFile.FullName -Destination "$OutputDir\Tesu_Trader_1.1.0.msi" -Force
    Write-Host "Copied MSI package -> $OutputDir\Tesu_Trader_1.1.0.msi"
}

# 3. Copy Single-File Portable Executable
$rawExe = "$releaseDir\nora.exe"
if (Test-Path $rawExe) {
    Copy-Item $rawExe -Destination "$OutputDir\Tesu_Trader.exe" -Force
    Write-Host "Copied True Single-File Portable executable -> $OutputDir\Tesu_Trader.exe"
}

Write-Host "All build outputs synchronized successfully to $OutputDir"

Write-Host "All build outputs synchronized successfully to $OutputDir"
