param(
  [switch]$Build,
  [switch]$Logs
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env.docker'
$ComposeArgs = @('compose')

if (Test-Path $EnvFile) {
  $ComposeArgs += @('--env-file', $EnvFile)
}

$ComposeArgs += @('-f', (Join-Path $Root 'docker-compose.dev.yml'))

if ($Build) {
  & docker @ComposeArgs build
}

& docker @ComposeArgs up -d

if ($Logs) {
  & docker @ComposeArgs logs -f web server
} else {
  Write-Host ''
  Write-Host 'Docker Linux development environment started:'
  Write-Host '  Web: http://localhost:5173'
  Write-Host '  API: http://localhost:3001/api/health'
  Write-Host '  MySQL: 127.0.0.1:3307'
  Write-Host '  Redis: 127.0.0.1:6380'
  Write-Host ''
  Write-Host 'Logs: powershell -ExecutionPolicy Bypass -File scripts/dev-docker-logs.ps1'
  Write-Host 'Stop: powershell -ExecutionPolicy Bypass -File scripts/dev-docker-down.ps1'
}
