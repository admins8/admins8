param(
  [switch]$Volumes
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env.docker'
$ComposeArgs = @('compose')

if (Test-Path $EnvFile) {
  $ComposeArgs += @('--env-file', $EnvFile)
}

$ComposeArgs += @('-f', (Join-Path $Root 'docker-compose.dev.yml'), 'down')

if ($Volumes) {
  $ComposeArgs += '--volumes'
}

& docker @ComposeArgs
