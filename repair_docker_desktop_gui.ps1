# 以管理员身份运行此脚本
# 用途：修复 Docker Desktop 双击无反应/GUI 闪退问题
# 说明：只备份并替换 Docker Desktop 前端 app.asar，不会删除 Docker 镜像、容器、WSL 数据。

$ErrorActionPreference = "Stop"

$dockerDir = "C:\Program Files\Docker\Docker"
$resourcesDir = Join-Path $dockerDir "frontend\resources"
$appAsar = Join-Path $resourcesDir "app.asar"
$backupAsar = Join-Path $resourcesDir ("app.asar.bad-" + (Get-Date -Format "yyyyMMddHHmmss"))
$candidateAsar = Join-Path $resourcesDir "app1.asar"
$dockerExe = Join-Path $dockerDir "Docker Desktop.exe"

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host "请右键 PowerShell，选择“以管理员身份运行”，再执行本脚本。" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $dockerExe)) {
    Write-Host "未找到 Docker Desktop：$dockerExe" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $candidateAsar)) {
    Write-Host "未找到候选修复文件：$candidateAsar" -ForegroundColor Red
    Write-Host "建议直接从 Docker 官网重新下载安装包，覆盖安装 Docker Desktop。" -ForegroundColor Yellow
    exit 1
}

Write-Host "停止 Docker Desktop 前端进程..."
Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "备份当前 app.asar 到：$backupAsar"
Copy-Item $appAsar $backupAsar -Force

Write-Host "替换前端 app.asar..."
Copy-Item $candidateAsar $appAsar -Force

Write-Host "启动 Docker Desktop..."
Start-Process -FilePath $dockerExe
Start-Sleep -Seconds 8

$gui = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if ($gui) {
    Write-Host "修复完成：Docker Desktop GUI 已启动。" -ForegroundColor Green
    $gui | Format-Table ProcessName,Id,StartTime,Responding,MainWindowTitle -AutoSize
} else {
    Write-Host "GUI 仍未启动。已保留备份：$backupAsar" -ForegroundColor Yellow
    Write-Host "下一步建议：卸载 Docker Desktop 后重新安装，但不要删除 WSL 发行版和 Docker 数据目录。" -ForegroundColor Yellow
}

