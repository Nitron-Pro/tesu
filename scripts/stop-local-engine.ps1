# Stops only Tesu processes that belong to THIS repository.
# Does not kill engine.exe / nora.exe / tesu_engine.exe from other projects.
$ErrorActionPreference = "SilentlyContinue"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LockFile = Join-Path $ProjectRoot "src\app\assets\bin\tesu_engine.exe"
$LocalAppSidecar = Join-Path $env:LOCALAPPDATA "com.tesu.trader"

function Test-ThisProjectProcess([string]$exePath) {
    if ([string]::IsNullOrWhiteSpace($exePath)) { return $false }
    try {
        $full = [System.IO.Path]::GetFullPath($exePath)
    } catch {
        return $false
    }
    $name = [System.IO.Path]::GetFileName($full)
    if ($name -ne "tesu_engine.exe" -and $name -ne "Tesu_Trader.exe") {
        return $false
    }
    if ($full.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    if ($full.StartsWith($LocalAppSidecar, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    return $false
}

$stopped = 0
Get-CimInstance Win32_Process | ForEach-Object {
    if (Test-ThisProjectProcess $_.ExecutablePath) {
        Write-Host "  Stopping PID $($_.ProcessId): $($_.ExecutablePath)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
    }
}

if ($stopped -eq 0) {
    Write-Host "  No Tesu processes from this project were running."
} else {
    Start-Sleep -Seconds 1
}

if (Test-Path $LockFile) {
    $bak = "$LockFile.old"
    try {
        if (Test-Path $bak) {
            Remove-Item $bak -Force -ErrorAction SilentlyContinue
        }
        Rename-Item -LiteralPath $LockFile -NewName "tesu_engine.exe.old" -Force -ErrorAction Stop
        Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host ""
        Write-Host "  [ERROR] tesu_engine.exe is still locked by another handle:"
        Write-Host "  $LockFile"
        Write-Host "  Close Tesu Trader for THIS project and retry. Other apps were not touched."
        Write-Host "  $($_.Exception.Message)"
        exit 1
    }
}

exit 0
