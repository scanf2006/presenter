$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\prepare-youtube-runtime.ps1')

function Assert-True($condition, [string]$message) {
  if (!$condition) { throw $message }
}
function Assert-Fails($action, [string]$message) {
  $failed = $false
  try { & $action | Out-Null } catch { $failed = $true }
  Assert-True $failed $message
}
function Invoke-WebRequest($Uri, $OutFile, $TimeoutSec, [switch]$UseBasicParsing) {
  $script:downloads++
  if ($script:interrupt) {
    [IO.File]::WriteAllText($OutFile, 'partial')
    throw 'Simulated interruption'
  }
  [IO.File]::Copy($script:fixture, $OutFile)
}

$testDir = Join-Path ([IO.Path]::GetTempPath()) ('presenter-runtime-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
$runtimeDir = Join-Path $testDir 'runtime'
$script:fixture = Join-Path $testDir 'source.bin'
$script:downloads = 0
$script:interrupt = $false
try {
  [IO.File]::WriteAllText($fixture, 'verified content')
  $hash = Get-AssetHash $fixture
  $asset = @{ name = 'test'; url = 'https://test.invalid/tool'; sha256 = $hash; files = @(@{ name = 'tool.exe'; sha256 = $hash }) }
  $target = Join-Path $runtimeDir 'tool.exe'
  Install-RuntimeAssets @($asset) $runtimeDir
  Assert-True (Test-AssetHash $target $hash) 'Fresh file was not verified'
  Install-RuntimeAssets @($asset) $runtimeDir
  Assert-True ($downloads -eq 1) 'Valid cache should not download'
  [IO.File]::WriteAllText($target, 'corrupt')
  Install-RuntimeAssets @($asset) $runtimeDir
  Assert-True (Test-AssetHash $target $hash) 'Corrupt cache was not replaced'

  $asset.sha256 = '0' * 64
  [IO.File]::WriteAllText($target, 'old file')
  Assert-Fails { Install-RuntimeAssets @($asset) $runtimeDir } 'Wrong archive hash must fail'
  Assert-True ([IO.File]::ReadAllText($target) -eq 'old file') 'Failed validation overwrote old file'
  $asset.sha256 = $hash
  $asset.files[0].sha256 = '0' * 64
  Assert-Fails { Install-RuntimeAssets @($asset) $runtimeDir } 'Wrong extracted hash must fail'
  Assert-True ([IO.File]::ReadAllText($target) -eq 'old file') 'Invalid extracted data was published'
  $script:interrupt = $true
  Assert-Fails { Install-RuntimeAssets @($asset) $runtimeDir } 'Interrupted download must fail'
  Assert-True ([IO.File]::ReadAllText($target) -eq 'old file') 'Interrupted download overwrote old file'
  Remove-Item -LiteralPath $target
  Assert-Fails { Install-RuntimeAssets @($asset) $runtimeDir } 'Interrupted fresh download must fail'
  Assert-True (!(Test-Path -LiteralPath $target)) 'Partial download entered runtime'
  $script:interrupt = $false

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipPath = Join-Path $testDir 'source.zip'
  $zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fixture, 'bin/tool.exe') | Out-Null
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fixture, 'LICENSE.txt') | Out-Null
  } finally { $zip.Dispose() }
  $script:fixture = $zipPath
  $asset.sha256 = Get-AssetHash $zipPath
  $asset.files = @(@{ name = 'tool.exe'; entry = 'bin/tool.exe'; sha256 = $hash }, @{ name = 'LICENSE.txt'; entry = 'missing'; sha256 = $hash })
  Assert-Fails { Install-RuntimeAssets @($asset) $runtimeDir } 'Missing entry must fail'
  Assert-True (!(Test-Path -LiteralPath $target)) 'Partially extracted asset was published'
  $asset.files[1].entry = 'LICENSE.txt'
  Install-RuntimeAssets @($asset) $runtimeDir
  $license = Join-Path $runtimeDir 'LICENSE.txt'
  Assert-True (Test-AssetHash $license $hash) 'Archive license was not verified'
  Remove-Item -LiteralPath $license
  Install-RuntimeAssets @($asset) $runtimeDir
  Assert-True (Test-AssetHash $license $hash) 'Missing license was not repaired'
  Assert-True (@(Get-ChildItem -LiteralPath $runtimeDir -Filter '*.tmp').Count -eq 0) 'Temporary files leaked'
  Write-Output 'All runtime integrity scenarios passed.'
} finally {
  # Only individual files in this newly-created test directory are removed.
  if (Test-Path -LiteralPath $runtimeDir) {
    Get-ChildItem -LiteralPath $runtimeDir -File | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
    Remove-Item -LiteralPath $runtimeDir
  }
  Get-ChildItem -LiteralPath $testDir -File | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  Remove-Item -LiteralPath $testDir
}
