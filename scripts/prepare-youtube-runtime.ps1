$ErrorActionPreference = 'Stop'

$runtimeDir = Join-Path $PSScriptRoot '..\vendor\youtube-runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Get-Asset([string]$url, [string]$destination) {
  if (Test-Path -LiteralPath $destination) { return }
  Invoke-WebRequest -Uri $url -OutFile $destination
}

function Expand-Entry([string]$zipPath, [string]$entryName, [string]$destination) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entry = $zip.GetEntry($entryName)
    if ($null -eq $entry) { throw "Missing archive entry: $entryName" }
    $input = $entry.Open()
    try {
      $output = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
      try { $input.CopyTo($output) } finally { $output.Dispose() }
    } finally { $input.Dispose() }
  } finally { $zip.Dispose() }
}

Get-Asset 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe' (Join-Path $runtimeDir 'yt-dlp.exe')

if (!(Test-Path -LiteralPath (Join-Path $runtimeDir 'deno.exe'))) {
  $denoZip = Join-Path $runtimeDir 'deno.zip'
  Get-Asset 'https://github.com/denoland/deno/releases/download/v2.9.6/deno-x86_64-pc-windows-msvc.zip' $denoZip
  Expand-Entry $denoZip 'deno.exe' (Join-Path $runtimeDir 'deno.exe')
  Remove-Item -LiteralPath $denoZip -Force
}

if (!(Test-Path -LiteralPath (Join-Path $runtimeDir 'ffmpeg.exe'))) {
  $ffmpegZip = Join-Path $runtimeDir 'ffmpeg.zip'
  Get-Asset 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-8.1.zip' $ffmpegZip
  Expand-Entry $ffmpegZip 'ffmpeg-n8.1-latest-win64-lgpl-8.1/bin/ffmpeg.exe' (Join-Path $runtimeDir 'ffmpeg.exe')
  Expand-Entry $ffmpegZip 'ffmpeg-n8.1-latest-win64-lgpl-8.1/LICENSE.txt' (Join-Path $runtimeDir 'ffmpeg-LGPL.txt')
  Remove-Item -LiteralPath $ffmpegZip -Force
}
