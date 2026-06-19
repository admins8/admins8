# Docker Desktop 4.77.0 中文汉化补丁安装脚本
# 用法：右键 PowerShell，选择“以管理员身份运行”，然后执行：
# Set-ExecutionPolicy -Scope Process Bypass
# & "d:\legado-home\docker_desktop_chinese_patch.ps1"

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==== $Message ====" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[注意] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[失败] $Message" -ForegroundColor Red
}

function Assert-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "请用管理员身份运行 PowerShell，再执行本脚本。"
    }
}

function Stop-DockerDesktop {
    Write-Step "关闭 Docker Desktop 相关进程"

    $processNames = @(
        "Docker Desktop",
        "Docker Desktop Backend",
        "com.docker.backend",
        "com.docker.proxy",
        "com.docker.service"
    )

    foreach ($name in $processNames) {
        Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 2

    try {
        & wsl --shutdown 2>$null
        Write-Ok "WSL 已关闭"
    } catch {
        Write-Warn "WSL 关闭命令未成功执行，继续处理"
    }

    Write-Ok "Docker Desktop 相关进程已尝试关闭"
}

function Copy-Checked {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "找不到源文件：$Source"
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Force

    if (-not (Test-Path $Destination)) {
        throw "复制失败：$Destination"
    }
}

function Test-GuiStart {
    param([string]$ExePath)

    Write-Step "启动 Docker Desktop 并检测 GUI"
    Start-Process -FilePath $ExePath

    for ($i = 1; $i -le 12; $i++) {
        Start-Sleep -Seconds 2
        $p = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
        if ($p) {
            Write-Ok "检测到 Docker Desktop GUI 进程"
            return $true
        }
        Write-Host "等待 GUI 启动中... $($i * 2) 秒"
    }

    return $false
}

function Restore-Backup {
    param(
        [string]$BackupExe,
        [string]$BackupAsar,
        [string]$TargetExe,
        [string]$TargetAsar
    )

    Write-Step "正在自动回滚到原版文件"

    Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "com.docker.backend" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Copy-Checked -Source $BackupExe -Destination $TargetExe
    Copy-Checked -Source $BackupAsar -Destination $TargetAsar

    Write-Ok "已恢复原版 Docker Desktop.exe 和 app.asar"
}

try {
    Write-Step "检查管理员权限"
    Assert-Admin
    Write-Ok "当前 PowerShell 是管理员权限"

    $PatchDir = "D:\我的文件\软件\Docker\汉化包"
    $PatchExe = Join-Path $PatchDir "Docker Desktop.exe"
    $PatchAsar = Join-Path $PatchDir "app.asar"

    $InstallDir = "C:\Program Files\Docker\Docker"
    $TargetExe = Join-Path $InstallDir "Docker Desktop.exe"
    $TargetAsar = Join-Path $InstallDir "frontend\resources\app.asar"

    $BackupRoot = "d:\legado-home\docker_backup_zh"
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDir = Join-Path $BackupRoot $Stamp
    $BackupExe = Join-Path $BackupDir "Docker Desktop.exe"
    $BackupAsar = Join-Path $BackupDir "app.asar"

    Write-Step "检查文件路径"
    foreach ($path in @($PatchExe, $PatchAsar, $TargetExe, $TargetAsar)) {
        if (-not (Test-Path $path)) {
            throw "找不到必要文件：$path"
        }
        Write-Ok "存在：$path"
    }

    Write-Step "显示当前文件哈希"
    Write-Host "当前原版 Docker Desktop.exe："
    Get-FileHash -LiteralPath $TargetExe -Algorithm SHA256 | Format-List
    Write-Host "当前原版 app.asar："
    Get-FileHash -LiteralPath $TargetAsar -Algorithm SHA256 | Format-List
    Write-Host "汉化包 Docker Desktop.exe："
    Get-FileHash -LiteralPath $PatchExe -Algorithm SHA256 | Format-List
    Write-Host "汉化包 app.asar："
    Get-FileHash -LiteralPath $PatchAsar -Algorithm SHA256 | Format-List

    Stop-DockerDesktop

    Write-Step "备份当前原版文件"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-Checked -Source $TargetExe -Destination $BackupExe
    Copy-Checked -Source $TargetAsar -Destination $BackupAsar
    Write-Ok "备份完成：$BackupDir"

    Write-Step "安装汉化文件"
    Copy-Checked -Source $PatchExe -Destination $TargetExe
    Copy-Checked -Source $PatchAsar -Destination $TargetAsar
    Write-Ok "汉化文件已复制到 Docker Desktop 安装目录"

    $started = Test-GuiStart -ExePath $TargetExe

    if (-not $started) {
        Write-Fail "汉化版 GUI 未能正常启动，开始回滚"
        Restore-Backup -BackupExe $BackupExe -BackupAsar $BackupAsar -TargetExe $TargetExe -TargetAsar $TargetAsar
        Start-Process -FilePath $TargetExe
        throw "汉化失败，已自动恢复原版。"
    }

    Write-Step "完成"
    Write-Ok "Docker Desktop 汉化补丁已安装，并且 GUI 已启动。"
    Write-Warn "如果 Docker Desktop 后续自动升级，汉化可能会失效，需要重新打补丁。"
    Write-Warn "如果遇到异常，可从备份目录手动恢复：$BackupDir"
}
catch {
    Write-Host ""
    Write-Fail $_.Exception.Message
    Write-Host ""
    Write-Host "按回车退出..."
    Read-Host | Out-Null
    exit 1
}

Write-Host ""
Write-Host "按回车退出..."
Read-Host | Out-Null
