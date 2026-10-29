# Inicia la cámara de la PC y la publica para verla desde la app.
#
# Uso (doble clic o desde una terminal):
#   camara\iniciar-camara.cmd
#
# La primera vez descarga FFmpeg y cloudflared dentro de camara\bin.
# Dejá esta ventana abierta mientras quieras ver la cámara.
#
# Al terminar muestra la URL pública, la copia al portapapeles y la guarda
# en camara\url-publica.txt. Esa URL cambia en cada arranque.

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 a veces negocia TLS 1.0 y Cloudflare lo rechaza,
# lo que hacía fallar la comprobación de la URL pública.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bin = Join-Path $Raiz "bin"
$ConfigPath = Join-Path $Raiz "config.json"
$ServidorJs = Join-Path $Raiz "server.mjs"
$LogCloudflare = Join-Path $Raiz "cloudflared.log"
$UrlPath = Join-Path $Raiz "url-publica.txt"
$PidsPath = Join-Path $Raiz "pids.json"

if (-not (Test-Path $Bin)) {
    New-Item -ItemType Directory -Path $Bin | Out-Null
}

function Escribir-Titulo {
    param([string]$Texto)
    Write-Host ""
    Write-Host "  $Texto" -ForegroundColor Cyan
}

function Asegurar-FFmpeg {
    $exe = Join-Path $Bin "ffmpeg.exe"
    if (Test-Path $exe) { return $exe }

    Escribir-Titulo "Descargando FFmpeg (unos 110 MB, solo la primera vez)..."
    $zip = Join-Path $Bin "ffmpeg.zip"
    Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $zip -UseBasicParsing

    Write-Host "  Descomprimiendo..." -ForegroundColor DarkGray
    tar -xf $zip -C $Bin

    $carpeta = Get-ChildItem $Bin -Directory -Filter "ffmpeg-*-essentials_build" | Select-Object -First 1
    if (-not $carpeta) { throw "No se pudo descomprimir FFmpeg." }

    Copy-Item (Join-Path $carpeta.FullName "bin\ffmpeg.exe") $exe -Force
    Copy-Item (Join-Path $carpeta.FullName "bin\ffprobe.exe") (Join-Path $Bin "ffprobe.exe") -Force
    Remove-Item $carpeta.FullName -Recurse -Force
    Remove-Item $zip -Force
    return $exe
}

function Asegurar-Cloudflared {
    $exe = Join-Path $Bin "cloudflared.exe"
    if (Test-Path $exe) { return $exe }

    Escribir-Titulo "Descargando cloudflared (acceso remoto, solo la primera vez)..."
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe
    return $exe
}

function Detectar-Camaras {
    param([string]$FFmpeg)

    # FFmpeg escribe la lista de dispositivos por stderr y termina con error
    # (la entrada "dummy" no existe). Con $ErrorActionPreference = "Stop"
    # PowerShell lo tomaría como un error fatal, así que volcamos la salida
    # a un archivo temporal y la leemos como texto plano.
    $temporal = Join-Path ([System.IO.Path]::GetTempPath()) "vision360-camaras-$PID.txt"

    try {
        & cmd /c "`"$FFmpeg`" -hide_banner -list_devices true -f dshow -i dummy > `"$temporal`" 2>&1" | Out-Null

        if (-not (Test-Path $temporal)) { return @() }
        $salida = Get-Content $temporal -Raw
    } catch {
        Write-Host "  Aviso: no se pudo listar las cámaras ($($_.Exception.Message))." -ForegroundColor Yellow
        return @()
    } finally {
        Remove-Item $temporal -Force -ErrorAction SilentlyContinue
    }

    if (-not $salida) { return @() }

    $camaras = @()
    foreach ($m in [regex]::Matches($salida, '"([^"]+)"\s+\(video\)')) {
        $camaras += $m.Groups[1].Value
    }
    return $camaras
}

function Leer-Config {
    $default = [ordered]@{
        camara  = ""
        puerto  = 8090
        ancho   = 1280
        fps     = 25
        bitrate = "2500k"
    }

    if (Test-Path $ConfigPath) {
        try {
            $leido = Get-Content $ConfigPath -Raw | ConvertFrom-Json
            if ($leido.camara) { $default.camara = $leido.camara }
            if ($leido.puerto) { $default.puerto = [int]$leido.puerto }
            if ($leido.ancho) { $default.ancho = [int]$leido.ancho }
            if ($leido.fps) { $default.fps = [int]$leido.fps }
            if ($leido.bitrate) { $default.bitrate = [string]$leido.bitrate }
        } catch {
            Write-Host "  Aviso: config.json inválido, se vuelve a generar." -ForegroundColor Yellow
        }
    }

    return $default
}

function Elegir-Camara {
    param([string]$Actual, [string[]]$Disponibles)

    if ($Disponibles.Count -eq 0) {
        throw "No se encontró ninguna cámara conectada a la PC."
    }

    if ($Disponibles.Count -eq 1) {
        if ($Actual -ne $Disponibles[0]) {
            Write-Host "  Cámara detectada: $($Disponibles[0])" -ForegroundColor Green
        }
        return $Disponibles[0]
    }

    if ($Actual -and $Disponibles -contains $Actual) { return $Actual }

    Write-Host ""
    Write-Host "  Cámaras disponibles:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $Disponibles.Count; $i++) {
        Write-Host ("    [{0}] {1}" -f ($i + 1), $Disponibles[$i])
    }

    $elegido = Read-Host "  Elegí el número de cámara (Enter = 1)"
    if (-not $elegido) { return $Disponibles[0] }

    $numero = 0
    if ([int]::TryParse($elegido, [ref]$numero) -and $numero -ge 1 -and $numero -le $Disponibles.Count) {
        return $Disponibles[$numero - 1]
    }

    Write-Host "  Opción inválida, se usa la primera." -ForegroundColor Yellow
    return $Disponibles[0]
}

function Liberar-Puerto {
    param([int]$Puerto)

    $conexiones = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conexiones) {
        $proceso = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proceso -and $proceso.ProcessName -eq "node") {
            Write-Host "  Cerrando servidor anterior en el puerto $Puerto..." -ForegroundColor Yellow
            & taskkill /PID $proceso.Id /T /F 2>&1 | Out-Null
            Start-Sleep -Milliseconds 800
        }
    }
}

function Obtener-IPLocal {
    try {
        $ip = Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
            Sort-Object -Property InterfaceMetric |
            Select-Object -First 1
        return $ip.IPAddress
    } catch {
        return "localhost"
    }
}

# ---------------------------------------------------------------------------
# Arranque
# ---------------------------------------------------------------------------

Clear-Host
Write-Host ""
Write-Host "  ==============================================" -ForegroundColor Cyan
Write-Host "   VISION360 - CAMARA EN VIVO" -ForegroundColor White
Write-Host "  ==============================================" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: falta Node.js. Instalalo desde https://nodejs.org" -ForegroundColor Red
    Read-Host "  Presioná Enter para salir"
    exit 1
}

$ffmpeg = Asegurar-FFmpeg
$cloudflared = Asegurar-Cloudflared

$config = Leer-Config

# Se cierra el servidor anterior ANTES de detectar cámaras: si FFmpeg sigue
# usando la webcam, la detección no la encuentra y el script aborta.
$puerto = [int]$config.puerto
Liberar-Puerto -Puerto $puerto

$camaras = Detectar-Camaras -FFmpeg $ffmpeg
$config.camara = Elegir-Camara -Actual $config.camara -Disponibles $camaras

if ($config.camara -ne "") {
    # Sin BOM: Node no puede parsear un JSON que empieza con BOM.
    $json = $config | ConvertTo-Json
    [System.IO.File]::WriteAllText($ConfigPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}

Escribir-Titulo "Iniciando servidor de cámara..."
$nodo = (Get-Command node).Source
$servidor = Start-Process -FilePath $nodo -ArgumentList @("`"$ServidorJs`"") -WorkingDirectory $Raiz -PassThru -NoNewWindow

$listo = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 1000
    if ($servidor.HasExited) { break }
    try {
        $estado = Invoke-RestMethod -Uri "http://127.0.0.1:$puerto/estado" -TimeoutSec 3
        if ($estado.transmitiendo) { $listo = $true; break }
    } catch { }
}

if ($servidor.HasExited) {
    Write-Host "  ERROR: el servidor de cámara no pudo iniciarse." -ForegroundColor Red
    Read-Host "  Presioná Enter para salir"
    exit 1
}

if (-not $listo) {
    Write-Host "  Aviso: la cámara todavía está iniciando." -ForegroundColor Yellow
}
else {
    Write-Host "  Cámara lista." -ForegroundColor Green
}

function Cerrar-Tuneles-Anteriores {
    # Un cloudflared viejo sigue vivo con una URL que ya no existe y, además,
    # deja el log bloqueado. Así el script terminaba mostrando la URL anterior.
    # Se cierra todo antes de abrir el túnel nuevo.
    $viejos = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($viejos) {
        Write-Host "  Cerrando túneles anteriores..." -ForegroundColor DarkGray
        foreach ($p in $viejos) {
            & taskkill /PID $p.Id /T /F 2>&1 | Out-Null
        }
        Start-Sleep -Milliseconds 1500
    }

    # Logs viejos: se conservan los últimos 5 por si hay que revisarlos.
    Get-ChildItem $Raiz -Filter "cloudflared-*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 5 |
        ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
}

function Obtener-UrlDelLog {
    param([string]$Ruta)

    if (-not (Test-Path $Ruta)) { return $null }

    $texto = Get-Content $Ruta -Raw -ErrorAction SilentlyContinue
    if (-not $texto) { return $null }

    $encontradas = @(
        [regex]::Matches($texto, "https://[a-z0-9-]+\.trycloudflare\.com") |
            ForEach-Object { $_.Value }
    )
    if ($encontradas.Count -eq 0) { return $null }

    # La ÚLTIMA del log es la del túnel recién creado.
    return $encontradas[$encontradas.Count - 1]
}

function Probar-Tunel {
    param([string]$Url, [int]$Intentos = 10)

    for ($j = 0; $j -lt $Intentos; $j++) {
        try {
            $estado = Invoke-RestMethod -Uri "$Url/estado" -TimeoutSec 8
            if ($null -ne $estado) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 2000
    }

    return $false
}

function Abrir-Tunel {
    param([string]$Exe, [int]$Puerto, [string]$Log)

    # Log único por intento: si un cloudflared anterior lo tenía tomado,
    # este escribe igual y no se mezclan URLs de intentos distintos.
    $marca = Get-Date -Format "yyyyMMdd-HHmmss"
    $logIntento = Join-Path (Split-Path -Parent $Log) "cloudflared-$marca.log"

    # --metrics con puerto 0 evita choques si quedó otro cloudflared abierto.
    $proceso = Start-Process -FilePath $Exe `
        -ArgumentList @(
            "tunnel", "--url", "http://127.0.0.1:$Puerto",
            "--no-autoupdate", "--metrics", "127.0.0.1:0",
            "--logfile", $logIntento
        ) `
        -PassThru -WindowStyle Hidden

    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Milliseconds 1000
        if ($proceso.HasExited) { break }

        $url = Obtener-UrlDelLog -Ruta $logIntento
        if ($url) {
            # No se anuncia hasta comprobar que el túnel responde de verdad.
            if (Probar-Tunel -Url $url) {
                return @{ proceso = $proceso; url = $url; log = $logIntento }
            }
        }
    }

    if (-not $proceso.HasExited) {
        & taskkill /PID $proceso.Id /T /F 2>&1 | Out-Null
    }
    return @{ proceso = $null; url = $null; log = $logIntento }
}

Escribir-Titulo "Abriendo acceso remoto (Cloudflare)..."

Cerrar-Tuneles-Anteriores

$tunel = Abrir-Tunel -Exe $cloudflared -Puerto $puerto -Log $LogCloudflare

if (-not $tunel.url) {
    Write-Host "  Cloudflare no respondió. Reintentando una vez..." -ForegroundColor Yellow
    Cerrar-Tuneles-Anteriores
    $tunel = Abrir-Tunel -Exe $cloudflared -Puerto $puerto -Log $LogCloudflare
}

$cloudflare = $tunel.proceso
$publica = $tunel.url

$ipLocal = Obtener-IPLocal

Write-Host ""
Write-Host "  ==============================================" -ForegroundColor Green
Write-Host "   CAMARA LISTA" -ForegroundColor Green
Write-Host "  ==============================================" -ForegroundColor Green
Write-Host "   Camara:        $($config.camara)"
Write-Host "   En esta PC:    http://localhost:$puerto"
Write-Host "   En tu red:     http://${ipLocal}:$puerto"

if ($publica) {
    Write-Host ""
    Write-Host "   URL PUBLICA:   $publica" -ForegroundColor Yellow
    try { Set-Clipboard -Value $publica } catch { }
    try {
        [System.IO.File]::WriteAllText($UrlPath, "$publica`r`n", (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
    Write-Host "   (copiada al portapapeles y guardada en camara\url-publica.txt)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "   En la app: Mi Barrio -> Camara en vivo" -ForegroundColor White
    Write-Host "   Toca el engranaje (arriba a la derecha) o el boton" -ForegroundColor White
    Write-Host "   'Cambiar direccion de la camara', pega esta URL y toca GUARDAR." -ForegroundColor White
    Write-Host ""
    Write-Host "   Esta URL cambia cada vez que se reinicia la camara." -ForegroundColor DarkYellow
    Write-Host "   Si ya estaba guardada otra, hay que reemplazarla en la app." -ForegroundColor DarkYellow
}
else {
    Write-Host ""
    Write-Host "   No se pudo abrir el acceso remoto." -ForegroundColor Red
    Write-Host "   En la misma WiFi podes usar: http://${ipLocal}:$puerto" -ForegroundColor Yellow
    Write-Host "   Revisa el log: $($tunel.log)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "   Deja esta ventana abierta. Ctrl+C para detener." -ForegroundColor DarkGray
Write-Host "  ==============================================" -ForegroundColor Green
Write-Host ""

$pidsJson = @{
    servidor    = $servidor.Id
    cloudflared = if ($cloudflare) { $cloudflare.Id } else { $null }
    puerto      = $puerto
} | ConvertTo-Json
[System.IO.File]::WriteAllText($PidsPath, $pidsJson, (New-Object System.Text.UTF8Encoding($false)))

$avisoCloudflare = $false

try {
    while ($true) {
        Start-Sleep -Seconds 2

        if ($servidor.HasExited) {
            Write-Host "  El servidor de camara se cerro." -ForegroundColor Red
            break
        }

        if (-not $avisoCloudflare -and $cloudflare -and $cloudflare.HasExited) {
            Write-Host "  Cloudflare se cerro: el acceso remoto dejo de funcionar." -ForegroundColor Yellow
            $avisoCloudflare = $true
        }
    }
}
finally {
    if ($cloudflare -and -not $cloudflare.HasExited) {
        & taskkill /PID $cloudflare.Id /T /F 2>&1 | Out-Null
    }
    if ($servidor -and -not $servidor.HasExited) {
        & taskkill /PID $servidor.Id /T /F 2>&1 | Out-Null
    }
    Remove-Item $PidsPath -Force -ErrorAction SilentlyContinue
    Write-Host "  Camara detenida." -ForegroundColor DarkGray
}
