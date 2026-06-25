param(
    [int]$Port = 8501,
    [switch]$NoOpen,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

$VenvDir = Join-Path $PSScriptRoot ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $PSScriptRoot "requirements.txt"
$InstallStamp = Join-Path $VenvDir ".requirements.stamp"
$LocalUrl = "http://127.0.0.1:$Port"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Green
}

function Get-SystemPython {
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        return @{ Command = $PyLauncher.Source; Args = @("-3") }
    }

    $Python = Get-Command python -ErrorAction SilentlyContinue
    if ($Python) {
        return @{ Command = $Python.Source; Args = @() }
    }

    throw "未找到 Python。请先安装 Python 3.10—3.12，并勾选 Add Python to PATH。"
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
    Write-Step "首次启动：创建本地虚拟环境 .venv"
    $SystemPython = Get-SystemPython
    & $SystemPython.Command @($SystemPython.Args + @("-m", "venv", $VenvDir))
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
    throw "虚拟环境创建失败：未找到 $VenvPython"
}

if (-not $SkipInstall) {
    $NeedsInstall = -not (Test-Path -LiteralPath $InstallStamp)
    if (-not $NeedsInstall -and (Test-Path -LiteralPath $Requirements)) {
        $NeedsInstall = (Get-Item -LiteralPath $Requirements).LastWriteTimeUtc -gt `
            (Get-Item -LiteralPath $InstallStamp).LastWriteTimeUtc
    }

    if ($NeedsInstall) {
        Write-Step "安装或更新依赖，这一步首次运行会比较久"
        & $VenvPython -m pip install --upgrade pip
        & $VenvPython -m pip install -r $Requirements
        Set-Content -LiteralPath $InstallStamp -Value (Get-Date -Format o) -Encoding UTF8
    }
    else {
        Write-Step "依赖已安装，跳过重复安装"
    }
}

Write-Step "启动 Regional Potential Lab：$LocalUrl"
if (-not $NoOpen) {
    Start-Process $LocalUrl
}

& $VenvPython -m streamlit run app.py `
    --server.port $Port `
    --server.address 127.0.0.1 `
    --server.headless true `
    --browser.gatherUsageStats false
