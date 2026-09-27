$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-AssetHash([string]$path) {
  $stream = [System.IO.File]::OpenRead($path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
  } finally { $stream.Dispose(); $sha.Dispose() }
}

function Test-AssetHash([string]$path, [string]$sha256) {
  return ($sha256 -match '^[0-9a-fA-F]{64}$' -and
    (Test-Path -LiteralPath $path -PathType Leaf) -and
    (Get-AssetHash $path) -eq $sha256)
}

function Expand-Entry([string]$zipPath, [string]$entryName, [string]$destination) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entry = $zip.GetEntry($entryName)
    if ($null -eq $entry) { throw "Missing archive entry: $entryName" }
    $sourceStream = $entry.Open()
    try {
      $output = [System.IO.File]::Open($destination, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
      try { $sourceStream.CopyTo($output); $output.Flush($true) } finally { $output.Dispose() }
    } finally { $sourceStream.Dispose() }
  } finally { $zip.Dispose() }
}

function Install-RuntimeAssets($assets, [string]$runtimeDir) {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  foreach ($asset in $assets) {
    $invalid = @($asset.files | Where-Object {
      !(Test-AssetHash (Join-Path $runtimeDir $_.name) $_.sha256)
    })
    if ($invalid.Count -eq 0) { continue }

    $download = Join-Path $runtimeDir ([guid]::NewGuid().ToString('N') + '.download.tmp')
    $staged = @()
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $asset.url -OutFile $download -TimeoutSec 300
      if (!(Test-AssetHash $download $asset.sha256)) { throw "Download checksum mismatch: $($asset.name)" }
      foreach ($file in $asset.files) {
        $destination = Join-Path $runtimeDir $file.name
        $temporary = $destination + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
        $staged += @{ temporary = $temporary; destination = $destination }
        if ($file.entry) {
          Expand-Entry $download $file.entry $temporary
        } else {
          [System.IO.File]::Copy($download, $temporary, $false)
        }
        if (!(Test-AssetHash $temporary $file.sha256)) { throw "File checksum mismatch: $($file.name)" }
      }
      # Only publish after every file in this asset has passed validation.
      foreach ($file in $staged) {
        if (Test-Path -LiteralPath $file.destination) {
          [System.IO.File]::Replace($file.temporary, $file.destination, [System.Management.Automation.Language.NullString]::Value)
        } else {
          [System.IO.File]::Move($file.temporary, $file.destination)
        }
      }
    } finally {
      foreach ($temporary in @($download) + @($staged | ForEach-Object { $_.temporary })) {
        if (Test-Path -LiteralPath $temporary -PathType Leaf) { Remove-Item -LiteralPath $temporary -Force }
      }
    }
  }
  Write-Output 'Runtime assets verified.'
}

# Dot-sourcing exposes the same implementation for offline failure-path tests.
if ($MyInvocation.InvocationName -ne '.') {
  $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'youtube-runtime.lock.json') -Raw | ConvertFrom-Json
  Install-RuntimeAssets $manifest.assets ([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\vendor\youtube-runtime')))
}
