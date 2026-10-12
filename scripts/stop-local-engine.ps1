# Unlocks this project's tesu_engine.exe for PyInstaller.
# Only stops tesu_engine.exe that is running FROM this repo's assets/bin.
# Does not kill Tesu_Trader, engine.exe, nora.exe, or engines from other folders.
# Does not call `exit` — that would close the parent build console window.

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LockFile = Join-Path $ProjectRoot "src\app\assets\bin\tesu_engine.exe"
$FailFlag = Join-Path $env:TEMP "tesu-stop-engine.fail"
Remove-Item -LiteralPath $FailFlag -Force -ErrorAction SilentlyContinue

function Test-LockingEngine([string]$exePath) {
    if ([string]::IsNullOrWhiteSpace($exePath)) { return $false }
    try {
        $full = [System.IO.Path]::GetFullPath($exePath)
        $lock = [System.IO.Path]::GetFullPath($LockFile)
        return $full.Equals($lock, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

if (Test-Path -LiteralPath $LockFile) {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
        if (Test-LockingEngine $_.ExecutablePath) {
            Write-Host "  Stopping PID $($_.ProcessId) (this project's tesu_engine.exe)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 800

    $bak = Join-Path (Split-Path $LockFile) "tesu_engine.exe.old"
    try {
        if (Test-Path -LiteralPath $bak) {
            Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue
        }
        Rename-Item -LiteralPath $LockFile -NewName "tesu_engine.exe.old" -Force -ErrorAction Stop
        Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue
        Write-Host "  Unlocked tesu_engine.exe for rebuild."
    } catch {
        Write-Host "  [ERROR] tesu_engine.exe is still locked:"
        Write-Host "  $LockFile"
        Write-Host "  $($_.Exception.Message)"
        Set-Content -LiteralPath $FailFlag -Value $_.Exception.Message
    }
} else {
    Write-Host "  tesu_engine.exe is not present yet. Nothing to unlock."
}
