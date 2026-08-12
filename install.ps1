<#
.SYNOPSIS
Practo Scraper Universal Installer

.DESCRIPTION
This script downloads, installs, and configures the Practo Scraper project.
It automatically self-heals missing package managers (uv, pnpm) and creates a desktop shortcut.
#>

$ErrorActionPreference = 'Stop'
$InstallDir = "$env:USERPROFILE\Documents\Practo-Scraper"
$Desktop = [Environment]::GetFolderPath("Desktop")

function Write-Heading {
    param([string]$Text)
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Text)
    Write-Host " -> $Text" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Text)
    Write-Host "`n[ERROR] $Text" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Heading "Practo Scraper Setup"

# 1. Prerequisite Strict Checks
Write-Info "Checking prerequisites..."
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Fail "Python is not installed or not in PATH.`nPlease download from https://www.python.org/downloads/ and ensure 'Add to PATH' is checked during installation."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js is not installed or not in PATH.`nPlease download from https://nodejs.org/ and ensure it's added to PATH."
}

# 2. Prerequisite Healing
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Info "Installing 'uv' Python package manager..."
    python -m pip install uv
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Info "Installing 'pnpm' Node package manager..."
    npm install -g pnpm
}

# 3. Clean Install Directory
if (Test-Path $InstallDir) {
    Write-Info "Cleaning previous installation..."
    Remove-Item -Recurse -Force $InstallDir
}

# 4. Download and Extract
$ZipPath = "$env:TEMP\Practo-Scraper.zip"
$ExtractPath = "$env:TEMP\Practo-Extract"

Write-Info "Downloading latest version from GitHub..."
Invoke-WebRequest -Uri "https://github.com/Ns81000/Practo-Scraper/archive/refs/heads/main.zip" -OutFile $ZipPath -UseBasicParsing

Write-Info "Extracting files..."
if (Test-Path $ExtractPath) { Remove-Item -Recurse -Force $ExtractPath }
Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force

Write-Info "Moving to $InstallDir..."
Move-Item "$ExtractPath\Practo-Scraper-main" $InstallDir

# Cleanup temp files
Remove-Item $ZipPath -Force
Remove-Item -Recurse -Force $ExtractPath

# 5. Project Setup
Write-Heading "Installing Dependencies"
Write-Info "Setting up Backend (uv)..."
Set-Location "$InstallDir\backend"
uv sync
Write-Info "Installing Playwright browsers..."
uv run playwright install chromium

Write-Info "Setting up Frontend (pnpm)..."
Set-Location "$InstallDir\frontend"
pnpm install

# 6. Create Launcher Script
Write-Heading "Configuring Launcher"
$LauncherPath = "$InstallDir\launch_scraper.bat"
$LauncherContent = @"
@echo off
title Practo Scraper Servers
echo =======================================
echo Starting Practo Scraper Services...
echo =======================================
echo.

echo [1/2] Starting Backend (Port 8000)...
start "Practo Backend" cmd /c "cd /d ""$InstallDir\backend"" && uv run uvicorn main:app --host 0.0.0.0 --port 8000"

echo [2/2] Starting Frontend (Port 5174)...
start "Practo Frontend" cmd /c "cd /d ""$InstallDir\frontend"" && pnpm run dev"

echo Waiting for servers to initialize...
timeout /t 5 >nul

echo Opening browser...
start http://localhost:5174

echo.
echo =======================================
echo BOTH SERVERS ARE RUNNING IN BACKGROUND WINDOWS
echo Close those windows to stop the servers when finished.
echo =======================================
pause
"@

Set-Content -Path $LauncherPath -Value $LauncherContent

# 7. Create Desktop Shortcut
Write-Info "Creating Desktop Shortcut..."
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$Desktop\Practo Scraper.lnk")
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "Launch Practo Scraper"

# Try to use the project's custom icon, otherwise fallback to a generic Windows system icon
$IconPath = "$InstallDir\frontend\public\favicon.ico"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = $IconPath
} else {
    $Shortcut.IconLocation = "shell32.dll,14" # Generic web icon fallback
}
$Shortcut.Save()

Write-Heading "Installation Complete!"
Write-Host "A shortcut named 'Practo Scraper' has been added to your desktop." -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
