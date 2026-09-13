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

# The app converts its own imported copy, so remove a Windows Internet-zone marker
# that can cause Office automation to reject an otherwise valid local presentation.
try { Unblock-File -LiteralPath $PptPath -ErrorAction Stop } catch {}

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$ppt = $null
$presentation = $null
$protectedView = $null
$previousAutomationSecurity = $null

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
    try { $ppt.DisplayAlerts = 1 } catch {}
    # Open imported decks with macros disabled so Trust Center prompts cannot block export.
    try {
        $previousAutomationSecurity = $ppt.AutomationSecurity
        $ppt.AutomationSecurity = [Microsoft.Office.Core.MsoAutomationSecurity]::msoAutomationSecurityForceDisable
    } catch {}

    try {
        $presentation = $ppt.Presentations.Open2007(
            $PptPath,
            [Microsoft.Office.Core.MsoTriState]::msoTrue,
            [Microsoft.Office.Core.MsoTriState]::msoFalse,
            [Microsoft.Office.Core.MsoTriState]::msoTrue,
            [Microsoft.Office.Core.MsoTriState]::msoTrue
        )
    } catch {
        # Office can reject automation opens for files that it will open in
        # Protected View. Edit that protected window, then export its slides.
        $protectedView = $ppt.ProtectedViewWindows.Open(
            $PptPath,
            '',
            [Microsoft.Office.Core.MsoTriState]::msoTrue
        )
        $presentation = $protectedView.Edit()
    }

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
    Write-Error "PPT conversion failed at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
    Write-Error "PPT conversion stack: $($_.ScriptStackTrace)"
    exit 1
}
finally {
    try {
        if ($ppt -and $null -ne $previousAutomationSecurity) {
            $ppt.AutomationSecurity = $previousAutomationSecurity
        }
    } catch {}
    try { if ($protectedView) { $protectedView.Close() } } catch {}
    Cleanup-PowerPoint -Presentation $presentation -PptApp $ppt
}
