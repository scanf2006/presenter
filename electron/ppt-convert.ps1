param(
    [Parameter(Mandatory=$true)][string]$PptPath,
    [Parameter(Mandatory=$true)][string]$OutputDir
)

$ErrorActionPreference = 'Stop'

function Cleanup-PowerPoint {
    param(
        [object]$Presentation,
        [object]$PptApp
    )
    try { if ($Presentation) { $Presentation.Close() } } catch {}
    try { if ($PptApp) { $PptApp.Quit() } } catch {}
    try {
        if ($Presentation) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($Presentation) }
        if ($PptApp) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($PptApp) }
    } catch {}
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

if (-not (Test-Path -LiteralPath $PptPath)) {
    throw "PPT file not found: $PptPath"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$ppt = $null
$presentation = $null

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
    try { $ppt.DisplayAlerts = 1 } catch {}

    $presentation = $ppt.Presentations.Open(
        $PptPath,
        [Microsoft.Office.Core.MsoTriState]::msoTrue,
        [Microsoft.Office.Core.MsoTriState]::msoFalse,
        [Microsoft.Office.Core.MsoTriState]::msoFalse
    )

    $slideCount = $presentation.Slides.Count
    for ($i = 1; $i -le $slideCount; $i++) {
        $slide = $presentation.Slides.Item($i)
        $outputFile = Join-Path $OutputDir ("slide_{0:D3}.png" -f $i)
        $slide.Export($outputFile, 'PNG', 1920, 1080)
        Write-Output "Exported: $outputFile"
    }

    Write-Output "DONE: $slideCount slides exported"
    exit 0
}
catch {
    Write-Error "PPT conversion failed: $($_.Exception.Message)"
    exit 1
}
finally {
    Cleanup-PowerPoint -Presentation $presentation -PptApp $ppt
}
