$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $root "assets"
$tmpDir = Join-Path $assetsDir "icon-tmp"
$icoPath = Join-Path $assetsDir "app-icon.ico"
$pngPath = Join-Path $assetsDir "app-icon.png"
$sizes = @(16, 24, 32, 48, 64, 128, 256)

function New-AntBitmap($size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $yellow = [System.Drawing.Color]::FromArgb(255, 215, 255, 114)
  $blackColor = [System.Drawing.Color]::FromArgb(255, 5, 8, 5)
  $graphics.Clear($yellow)

  $scale = $size / 256.0
  $graphics.ScaleTransform($scale, $scale)

  $black = New-Object System.Drawing.SolidBrush $blackColor
  $yellowBrush = New-Object System.Drawing.SolidBrush $yellow
  $yellowPen = New-Object System.Drawing.Pen $yellow, 9
  $blackPen = New-Object System.Drawing.Pen $blackColor, 13
  $blackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $blackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $yellowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $yellowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $graphics.FillEllipse($black, 38, 89, 68, 68)
  $graphics.FillEllipse($black, 82, 77, 126, 116)
  $graphics.FillEllipse($black, 44, 98, 57, 70)
  $graphics.FillEllipse($yellowBrush, 40, 87, 10, 10)

  $graphics.DrawLine($blackPen, 52, 80, 28, 50)
  $graphics.DrawLine($blackPen, 75, 80, 91, 47)
  $graphics.DrawLine($blackPen, 105, 172, 78, 217)
  $graphics.DrawLine($blackPen, 139, 185, 126, 225)
  $graphics.DrawLine($blackPen, 175, 180, 204, 220)
  $graphics.DrawLine($blackPen, 199, 151, 231, 173)

  $graphics.DrawLine($yellowPen, 129, 110, 173, 110)
  $graphics.DrawLine($yellowPen, 129, 136, 183, 136)
  $graphics.DrawLine($yellowPen, 129, 162, 166, 162)

  $graphics.Dispose()
  $black.Dispose()
  $yellowBrush.Dispose()
  $yellowPen.Dispose()
  $blackPen.Dispose()
  return $bitmap
}

if (-not (Test-Path $assetsDir)) {
  New-Item -ItemType Directory -Path $assetsDir | Out-Null
}

if (Test-Path $tmpDir) {
  Remove-Item -LiteralPath $tmpDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tmpDir | Out-Null

$pngFiles = @()
foreach ($size in $sizes) {
  $bitmap = New-AntBitmap $size
  $file = Join-Path $tmpDir "icon-$size.png"
  $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($size -eq 256) {
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $bitmap.Dispose()
  $pngFiles += $file
}

$nodeScript = Join-Path $tmpDir "make-ico.mjs"
$jsonFiles = ($pngFiles | ConvertTo-Json -Compress).Replace("\", "\\")
$jsonOut = ($icoPath | ConvertTo-Json -Compress).Replace("\", "\\")
@"
import pngToIco from 'png-to-ico';
import { writeFile } from 'node:fs/promises';
const files = $jsonFiles;
const output = $jsonOut;
const buffer = await pngToIco(files);
await writeFile(output, buffer);
"@ | Set-Content -LiteralPath $nodeScript -Encoding UTF8

node $nodeScript
Remove-Item -LiteralPath $tmpDir -Recurse -Force

Write-Host "Created: $icoPath"
Write-Host "Created: $pngPath"
