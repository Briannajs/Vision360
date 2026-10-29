# Detiene la cámara de Visión360: servidor, FFmpeg y túnel de Cloudflare.

$ErrorActionPreference = "SilentlyContinue"

$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidsPath = Join-Path $Raiz "pids.json"

Write-Host ""

if (Test-Path $PidsPath) {
    try {
        $pids = Get-Content $PidsPath -Raw | ConvertFrom-Json
        foreach ($id in @($pids.servidor, $pids.cloudflared)) {
            if ($id) { & taskkill /PID $id /T /F 2>&1 | Out-Null }
        }
        Write-Host "  Procesos del script detenidos." -ForegroundColor DarkGray
    } catch {
        Write-Host "  No se pudo leer pids.json." -ForegroundColor Yellow
    }
    Remove-Item $PidsPath -Force
}

# Por si quedó algo suelto (por ejemplo, si se cerró la ventana a la fuerza).
$puerto = 8090
$configPath = Join-Path $Raiz "config.json"
if (Test-Path $configPath) {
    try {
        $leido = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($leido.puerto) { $puerto = [int]$leido.puerto }
    } catch { }
}

Get-NetTCPConnection -LocalPort $puerto -State Listen |
    ForEach-Object { & taskkill /PID $_.OwningProcess /T /F 2>&1 | Out-Null }

Get-Process cloudflared |
    ForEach-Object { & taskkill /PID $_.Id /T /F 2>&1 | Out-Null }

Get-Process ffmpeg |
    ForEach-Object { & taskkill /PID $_.Id /T /F 2>&1 | Out-Null }

Write-Host "  Cámara detenida." -ForegroundColor Green
Write-Host ""

# La URL del túnel ya no sirve: se borra el archivo para no confundir.
Remove-Item (Join-Path $Raiz "url-publica.txt") -Force -ErrorAction SilentlyContinue
