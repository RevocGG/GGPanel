param([string]$Version = (Get-Date -Format 'yyyy.MM.dd'))
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$UI_ROOT  = (Get-Location).Path
$DIST_DIR = Join-Path $UI_ROOT '..\dist'
$BUNDLE   = Join-Path $DIST_DIR 'GGoose-Panel-win-x64'
$APP_DIR  = Join-Path $BUNDLE 'app'

Write-Host ""
Write-Host "=== GGoose UI -- Building Windows distribution v$Version ==="
Write-Host ""

# 1. Clean
if (Test-Path $BUNDLE) {
    Write-Host "[1/6] Cleaning previous dist..."
    Remove-Item $BUNDLE -Recurse -Force
}
New-Item $APP_DIR -ItemType Directory -Force | Out-Null

# 2. Build
Write-Host "[2/6] Running next build..."
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "next build failed" }

# 3. Copy standalone
Write-Host "[3/6] Copying standalone server..."
Copy-Item "$UI_ROOT\.next\standalone\*" $APP_DIR -Recurse -Force

New-Item "$APP_DIR\.next\static" -ItemType Directory -Force | Out-Null
Copy-Item "$UI_ROOT\.next\static\*" "$APP_DIR\.next\static" -Recurse -Force

if (Test-Path "$UI_ROOT\public") {
    Copy-Item "$UI_ROOT\public\*" $APP_DIR -Recurse -Force
}

# 4. Runtime extras
Write-Host "[4/6] Copying runtime extras..."

New-Item "$APP_DIR\prisma" -ItemType Directory -Force | Out-Null
Copy-Item "$UI_ROOT\prisma\*" "$APP_DIR\prisma" -Recurse -Force

Copy-Item "$UI_ROOT\scripts\setup.js"   $APP_DIR -Force
Copy-Item "$UI_ROOT\scripts\launcher.js" $APP_DIR -Force

New-Item "$APP_DIR\scripts" -ItemType Directory -Force | Out-Null
Copy-Item "$UI_ROOT\scripts\install.bat"   "$APP_DIR\scripts" -Force
Copy-Item "$UI_ROOT\scripts\start.bat"     "$APP_DIR\scripts" -Force
Copy-Item "$UI_ROOT\scripts\uninstall.bat" "$APP_DIR\scripts" -Force

New-Item "$APP_DIR\data\cores"   -ItemType Directory -Force | Out-Null
New-Item "$APP_DIR\data\configs" -ItemType Directory -Force | Out-Null

# 5. node.exe
Write-Host "[5/6] Embedding node.exe..."
$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCmd) {
    Copy-Item $nodeCmd.Source $APP_DIR -Force
    Write-Host "      Copied from $($nodeCmd.Source)"
} else {
    Write-Warning "node.exe not found in PATH -- add it to app\ manually."
}

# 6. Launcher bat
Write-Host "[6/6] Writing GGoose-Panel.bat..."
Copy-Item "$UI_ROOT\scripts\GGoose-Panel.bat" $BUNDLE -Force

# 7. Zip
Write-Host "Zipping..."
$ZIP_PATH = Join-Path $DIST_DIR 'GGoose-Panel-win-x64.zip'
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }
Compress-Archive -Path $BUNDLE -DestinationPath $ZIP_PATH -CompressionLevel Optimal

Write-Host ""
Write-Host "=== Done! ==="
Write-Host "Folder : $BUNDLE"
Write-Host "Zip    : $ZIP_PATH"
Write-Host "Run    : double-click GGoose-Panel-win-x64\GGoose-Panel.bat"
Write-Host ""
