# build.ps1 - eBook Annotator Chrome Extension Build Script (Windows)
#
# Requirements: PowerShell 5+
# Usage: .\build.ps1

param(
    [string]$ArtifactsDir = "dist"
)

$ErrorActionPreference = "Stop"

Write-Host "eBook Annotator - Chrome Extension Builder" -ForegroundColor Cyan
Write-Host ""

# Create artifacts directory
if (-not (Test-Path $ArtifactsDir)) {
    New-Item -ItemType Directory -Path $ArtifactsDir | Out-Null
}

$zipName = "any_ebook_reader_annotator-1.0.0.zip"
$zipPath = Join-Path $ArtifactsDir $zipName

# Remove old build
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Files and directories to include
$includes = @(
    "manifest.json",
    "background.js",
    "popup",
    "reader",
    "lib",
    "icons"
)

# Create a temp staging directory
$staging = Join-Path $env:TEMP "ebook-annotator-build-$(Get-Random)"
New-Item -ItemType Directory -Path $staging | Out-Null

try {
    foreach ($item in $includes) {
        $src = Join-Path $PSScriptRoot $item
        $dst = Join-Path $staging $item
        if (Test-Path $src -PathType Container) {
            Copy-Item $src $dst -Recurse
        } else {
            Copy-Item $src $dst
        }
    }

    # Create zip
    Write-Host "Creating zip archive..." -ForegroundColor Cyan
    Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -Force

    Write-Host ""
    Write-Host "Build complete: $zipPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "To install in Chrome:" -ForegroundColor Yellow
    Write-Host "  1. Go to chrome://extensions/" -ForegroundColor Yellow
    Write-Host "  2. Enable Developer mode" -ForegroundColor Yellow
    Write-Host "  3. Click Load unpacked and select this project folder" -ForegroundColor Yellow
    Write-Host "  (or upload the .zip to the Chrome Web Store)" -ForegroundColor Yellow
}
finally {
    # Clean up staging
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
