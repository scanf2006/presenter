Write-Host "Starting ChurchDisplay Pro development environment..." -ForegroundColor Cyan
$env:ELECTRON_RUN_AS_NODE=$null
npm run electron:dev
