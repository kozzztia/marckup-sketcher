$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$packagedDir = Join-Path $root "packaged"
$appDir = Join-Path $packagedDir "Markup Sketcher-win32-x64"
$releaseDir = Join-Path $root "release"
$zipPath = Join-Path $releaseDir "markup-sketcher-app.zip"
$stubSource = Join-Path $releaseDir "PortableLauncher.cs"
$stubExe = Join-Path $releaseDir "PortableLauncher.exe"
$portableExe = Join-Path $releaseDir "Markup Sketcher Portable.exe"
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $csc)) {
  throw "C# compiler was not found at $csc"
}

if (Test-Path $releaseDir) {
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseDir | Out-Null

Push-Location $root
try {
  npm run build
  npx electron-packager . "Markup Sketcher" --platform=win32 --arch=x64 --out=packaged --overwrite --ignore="^/node_modules/(electron-builder|electron-packager|@electron/packager|app-builder-lib|builder-util|7zip-bin|electron-winstaller|electron-installer-.*)" --ignore="^/release" --ignore="^/packaged" --ignore="^/src"
}
finally {
  Pop-Location
}

if (-not (Test-Path $appDir)) {
  throw "Packaged app was not created at $appDir"
}

Compress-Archive -Path (Join-Path $appDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

@'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;

public static class PortableLauncher
{
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("MSKPORT1");

    [STAThread]
    public static int Main()
    {
        try
        {
            string self = Assembly.GetExecutingAssembly().Location;
            byte[] zipBytes = ReadAppPayload(self);
            string extractRoot = Path.Combine(Path.GetTempPath(), "MarkupSketcherPortable");
            string appRoot = Path.Combine(extractRoot, "app");
            string marker = Path.Combine(extractRoot, "payload.size");

            string sizeText = zipBytes.Length.ToString();
            if (!File.Exists(Path.Combine(appRoot, "Markup Sketcher.exe")) || !File.Exists(marker) || File.ReadAllText(marker) != sizeText)
            {
                if (Directory.Exists(appRoot))
                {
                    Directory.Delete(appRoot, true);
                }

                Directory.CreateDirectory(appRoot);

                using (var memory = new MemoryStream(zipBytes))
                using (var archive = new ZipArchive(memory, ZipArchiveMode.Read))
                {
                    archive.ExtractToDirectory(appRoot);
                }

                Directory.CreateDirectory(extractRoot);
                File.WriteAllText(marker, sizeText);
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = Path.Combine(appRoot, "Markup Sketcher.exe"),
                WorkingDirectory = appRoot,
                UseShellExecute = true
            });

            return 0;
        }
        catch (Exception ex)
        {
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "MarkupSketcherPortable-error.txt"), ex.ToString());
            return 1;
        }
    }

    private static byte[] ReadAppPayload(string self)
    {
        byte[] allBytes = File.ReadAllBytes(self);
        int footerLength = Magic.Length + sizeof(long);
        if (allBytes.Length < footerLength)
        {
            throw new InvalidOperationException("Portable payload is missing.");
        }

        int magicOffset = allBytes.Length - Magic.Length;
        for (int i = 0; i < Magic.Length; i++)
        {
            if (allBytes[magicOffset + i] != Magic[i])
            {
                throw new InvalidOperationException("Portable payload marker is invalid.");
            }
        }

        long zipLength = BitConverter.ToInt64(allBytes, magicOffset - sizeof(long));
        long zipOffset = magicOffset - sizeof(long) - zipLength;
        if (zipLength <= 0 || zipOffset < 0)
        {
            throw new InvalidOperationException("Portable payload length is invalid.");
        }

        byte[] zipBytes = new byte[zipLength];
        Buffer.BlockCopy(allBytes, (int)zipOffset, zipBytes, 0, (int)zipLength);
        return zipBytes;
    }
}
'@ | Set-Content -LiteralPath $stubSource -Encoding UTF8

& $csc /nologo /target:winexe /out:$stubExe /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $stubSource

$stubBytes = [System.IO.File]::ReadAllBytes($stubExe)
$zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
$lengthBytes = [System.BitConverter]::GetBytes([Int64]$zipBytes.Length)
$magicBytes = [System.Text.Encoding]::ASCII.GetBytes("MSKPORT1")

$output = [System.IO.File]::Create($portableExe)
try {
  $output.Write($stubBytes, 0, $stubBytes.Length)
  $output.Write($zipBytes, 0, $zipBytes.Length)
  $output.Write($lengthBytes, 0, $lengthBytes.Length)
  $output.Write($magicBytes, 0, $magicBytes.Length)
}
finally {
  $output.Dispose()
}

Remove-Item -LiteralPath $zipPath, $stubSource, $stubExe -Force

Write-Host "Created: $portableExe"
