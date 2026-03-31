Write-Host "正在启动 ChurchDisplay Pro 开发环境..." -ForegroundColor Cyan
$env:ELECTRON_RUN_AS_NODE=$null
npm run electron:dev
