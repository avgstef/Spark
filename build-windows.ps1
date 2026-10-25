<#
    PromptForge AI - Windows build (PowerShell version)
    More reliable than the .bat if your shell has unusual settings.

    HOW TO RUN:
      1. Right-click this file -> "Run with PowerShell"
      OR from a terminal in this folder:
         powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
#>

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$log = Join-Path $PSScriptRoot 'build-log.txt'
"PromptForge AI build - $(Get-Date)" | Out-File $log -Encoding utf8

function Write-Step($msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host ""
    Write-Host "  [X] $msg" -ForegroundColor Red
    Write-Host "      See $log for details."
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Magenta
Write-Host "    PromptForge AI - Windows build" -ForegroundColor Magenta
Write-Host "  ==================================================" -ForegroundColor Magenta

# --- check Node ---------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js was not found. Install the LTS version from https://nodejs.org (keep 'Add to PATH' checked), then try again."
}
$nodeVersion = (& node -v)
Write-Host "  [i] Node.js $nodeVersion detected"

# --- install ------------------------------------------------------------------
if (-not (Test-Path 'node_modules')) {
    Write-Step "[1/3] Installing dependencies. First run takes a few minutes..."
    & npm install --no-fund --no-audit 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
} else {
    Write-Step "[1/3] Dependencies already installed, skipping."
}

# --- build --------------------------------------------------------------------
Write-Step "[2/3] Building the app bundle..."
& npm run build 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Fail "The app bundle failed to build." }

# --- package ------------------------------------------------------------------
Write-Step "[3/3] Packaging for Windows (downloads Electron, first run is slow)..."
& npx electron-builder --win 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Fail "electron-builder failed." }

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "    BUILD SUCCESSFUL" -ForegroundColor Green
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host ""

$exes = Get-ChildItem -Path (Join-Path $PSScriptRoot 'release') -Filter *.exe -ErrorAction SilentlyContinue
if ($exes) {
    Write-Host "  Created:"
    $exes | ForEach-Object { Write-Host ("    " + $_.Name + "  (" + [math]::Round($_.Length / 1MB) + " MB)") }
} else {
    Write-Host "  No .exe produced - check build-log.txt"
}

Write-Host ""
Write-Host "  Note: 'PromptForge-AI-<version>-x64.exe' is the installer."
Write-Host "        Any 'portable' file runs without installing."
Write-Host ""
Read-Host "  Press Enter to close"
