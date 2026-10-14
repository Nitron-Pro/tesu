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

# 3. Copy Portable Single-File Executable
$rawExe = "$releaseDir\nora.exe"
$portable = [System.IO.Path]::GetFullPath((Join-Path $OutputDir "Tesu_Trader.exe"))
if (Test-Path $rawExe) {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.ExecutablePath -and $_.ExecutablePath -eq $portable) {
            Write-Host "Stopping running portable build PID $($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 600

    $copied = $false
    try {
        Copy-Item $rawExe -Destination $portable -Force -ErrorAction Stop
        $copied = $true
    } catch {
        $old = "$portable.old"
        try {
            if (Test-Path $old) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
            Rename-Item -LiteralPath $portable -NewName "Tesu_Trader.exe.old" -Force -ErrorAction Stop
            Copy-Item $rawExe -Destination $portable -Force -ErrorAction Stop
            Remove-Item $old -Force -ErrorAction SilentlyContinue
            $copied = $true
        } catch {
            Write-Host "[ERROR] Could not replace locked file: $portable"
            Write-Host $_.Exception.Message
            exit 1
        }
    }
    if ($copied) {
        Write-Host "Copied Portable executable -> $portable"
    }
}

# Clean up any leftover secondary executables to ensure STRICT SINGLE-FILE output
$obsoleteEngine = "$OutputDir\engine.exe"
if (Test-Path $obsoleteEngine) {
    Remove-Item $obsoleteEngine -Force -ErrorAction SilentlyContinue
}
$obsoleteTesuEngine = "$OutputDir\tesu_engine.exe"
if (Test-Path $obsoleteTesuEngine) {
    Remove-Item $obsoleteTesuEngine -Force -ErrorAction SilentlyContinue
}
$obsoleteZip = "$OutputDir\Tesu_Trader_1.1.0_Portable.zip"
if (Test-Path $obsoleteZip) {
    Remove-Item $obsoleteZip -Force -ErrorAction SilentlyContinue
}

Write-Host "All build outputs synchronized successfully to $OutputDir"
