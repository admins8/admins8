$ErrorActionPreference = 'SilentlyContinue'

$Root = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $Root 'server'
$WebDir = Join-Path $Root 'web'
$Ports = @(3001, 5173)

function Test-PortOpen($hostName, $port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($hostName, $port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(1000, $false)
    if ($ok) {
      $client.EndConnect($async)
      $client.Close()
      return $true
    }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

function Start-MySqlIfPossible {
  if (Test-PortOpen '127.0.0.1' 3306) {
    Write-Host 'MySQL 已在运行。' -ForegroundColor Green
    return $true
  }

  Write-Host '正在尝试启动 MySQL 服务...' -ForegroundColor Cyan
  $services = Get-Service | Where-Object {
    $_.Name -match 'mysql|mariadb' -or $_.DisplayName -match 'mysql|mariadb'
  }

  foreach ($service in $services) {
    if ($service.Status -ne 'Running') {
      Start-Service -Name $service.Name
      Start-Sleep -Seconds 3
    }
    if (Test-PortOpen '127.0.0.1' 3306) {
      Write-Host "MySQL 服务已启动：$($service.DisplayName)" -ForegroundColor Green
      return $true
    }
  }

  Write-Host ''
  Write-Host '未检测到正在运行的 MySQL，也没有找到可自动启动的 MySQL/MariaDB 系统服务。' -ForegroundColor Yellow
  Write-Host '请先手动启动你的 MySQL，例如小皮面板、phpStudy、XAMPP、MySQL Installer 或其他数据库服务。' -ForegroundColor Yellow
  Write-Host '数据库启动后，再双击这个脚本即可一键重启前后端。' -ForegroundColor Yellow
  Write-Host ''
  return $false
}

function Wait-ForPort($hostName, $port, $seconds, $label) {
  Write-Host "正在等待 $label 启动..." -ForegroundColor Cyan
  for ($i = 1; $i -le $seconds; $i++) {
    if (Test-PortOpen $hostName $port) {
      Write-Host "$label 已就绪。" -ForegroundColor Green
      return $true
    }
    Start-Sleep -Seconds 1
  }
  Write-Host "$label 暂未就绪，请查看对应服务窗口日志。" -ForegroundColor Yellow
  return $false
}

Write-Host '正在停止旧服务...' -ForegroundColor Cyan
foreach ($port in $Ports) {
  $lines = netstat -ano | findstr ":$port"
  foreach ($line in $lines) {
    $parts = ($line -split '\s+') | Where-Object { $_ }
    if ($parts.Length -gt 0) {
      $pidToStop = [int]$parts[-1]
      if ($pidToStop -gt 0) {
        Stop-Process -Id $pidToStop -Force
      }
    }
  }
}

Start-Sleep -Seconds 1

$mysqlReady = Start-MySqlIfPossible

if ($mysqlReady) {
  Wait-ForPort '127.0.0.1' 3306 30 'MySQL'

  Write-Host '正在启动后端服务：http://localhost:3001' -ForegroundColor Cyan
  Start-Process powershell -WorkingDirectory $ServerDir -ArgumentList @(
    '-NoExit',
    '-Command',
    'chcp 65001 > $null; npm run dev'
  )

  Wait-ForPort '127.0.0.1' 3001 30 '后端服务'
} else {
  Write-Host '跳过后端启动：MySQL 未就绪。' -ForegroundColor Yellow
}

Write-Host '正在启动前端服务：http://localhost:5173' -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $WebDir -ArgumentList @(
  '-NoExit',
  '-Command',
  'chcp 65001 > $null; npx vite --force --host 127.0.0.1 --port 5173'
)

Wait-ForPort '127.0.0.1' 5173 30 '前端服务'
Start-Process 'http://localhost:5173/'

Write-Host ''
if ($mysqlReady) {
  Write-Host '已完成一键启动：MySQL、后端、前端。' -ForegroundColor Green
} else {
  Write-Host '注意：后端需要 MySQL。请先启动 MySQL 后重新运行本脚本。' -ForegroundColor Yellow
}
Write-Host '访问地址：http://localhost:5173/' -ForegroundColor Green
