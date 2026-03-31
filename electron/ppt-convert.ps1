# ChurchDisplay Pro - PPT 转图片脚本
param([Parameter(Mandatory=$true)][string]$PptPath, [Parameter(Mandatory=$true)][string]$OutputDir)

trap { Write-Error "PPT 转换失败: $_"; try { if ($presentation) { $presentation.Close() }; if ($ppt) { $ppt.Quit() } } catch {}; exit 1 }

# 检查文件是否存在
if (-not (Test-Path $PptPath)) {
    Write-Error "文件不存在: $PptPath"
    exit 1
}

# 创建输出目录
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 启动 PowerPoint COM 对象
Write-Output "正在启动 PowerPoint..."
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

# 打开演示文稿
Write-Output "正在打开文件: $PptPath"
$presentation = $ppt.Presentations.Open($PptPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)

# 导出每一张幻灯片为 PNG
$slideCount = $presentation.Slides.Count
Write-Output "共 $slideCount 张幻灯片"

for ($i = 1; $i -le $slideCount; $i++) {
    $slide = $presentation.Slides.Item($i)
    $outputFile = Join-Path $OutputDir ("slide_{0:D3}.png" -f $i)
    $slide.Export($outputFile, "PNG", 1920, 1080)
    Write-Output "已导出: slide_$('{0:D3}' -f $i).png"
}

# 关闭演示文稿和 PowerPoint
$presentation.Close()
$ppt.Quit()

# 释放 COM 对象
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
[System.GC]::Collect() | Out-Null

Write-Output "PPT 转换完成，共导出 $slideCount 张图片到: $OutputDir"
exit 0
