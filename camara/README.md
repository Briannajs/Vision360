# Cámara en vivo (webcam de la PC → celular)

Este servidor toma una webcam conectada a la PC y la publica por internet
para verla desde la app Visión360 en el celular, desde cualquier lugar.

```
Webcam USB ──► FFmpeg ──► HLS ──► servidor Node ──► Cloudflare ──► App
              (PC)                (PC :8090)        (URL https)    (celular)
```

No graba video: solo transmite en vivo y permite sacar capturas (JPEG).

## Requisitos

- Windows con la webcam conectada.
- Node.js instalado (ya lo usa el proyecto).
- Internet (para el acceso remoto).
- La PC tiene que quedar **encendida** y con esta ventana abierta.

## Uso rápido

1. Abrí la carpeta `camara` y hacé doble clic en **`iniciar-camara.cmd`**.
2. La primera vez descarga FFmpeg (~110 MB) y cloudflared (~50 MB) dentro de
   `camara/bin`. Puede tardar unos minutos.
3. Si hay más de una cámara, elegí el número y presioná Enter.
4. Esperá a que aparezca:

   ```
   URL PUBLICA:   https://algo-random.trycloudflare.com
   ```

   Esa URL se copia sola al portapapeles y también queda guardada en
   `camara/url-publica.txt`, por si se pierde la ventana.
5. En la app: **Mi Barrio → Cámara en vivo**.
6. Tocá el **engranaje** (arriba a la derecha) o el botón
   **"Cambiar dirección de la cámara"**, pegá la URL y tocá **GUARDAR**.

La dirección se puede cambiar en cualquier momento, aunque la cámara esté
fallando: el engranaje sigue visible y la pantalla de error tiene su propio
enlace para cambiarla.

Para detenerla, cerrá la ventana o usá **`detener-camara.cmd`**.

> La URL de Cloudflare cambia cada vez que iniciás el servidor. Si cambia,
> volvé a pegarla en la app. El script cierra los túneles anteriores antes de
> abrir uno nuevo y comprueba que responda, así nunca muestra una URL vieja.

## Sin internet (misma WiFi)

En la misma red también funciona sin Cloudflare. La ventana muestra una URL
así:

```
En tu red:  http://192.168.1.15:8090
```

Pegá esa URL en la app (celular conectado a la misma WiFi). Si Windows
pregunta por el Firewall, permití el acceso en redes privadas.

## Configuración opcional

`camara/config.json`:

```json
{
  "camara": "HD 2MP WEBCAM",
  "puerto": 8090,
  "ancho": 1280,
  "fps": 25,
  "bitrate": "2500k"
}
```

- `camara`: nombre exacto del dispositivo (lo detecta el script solo).
- `ancho`: resolución de salida. 1280 es buen equilibrio; 1920 pesa más.
- `fps`: 25 es suficiente para vigilancia.
- `bitrate`: 2500k ≈ 2,5 Mbps. Con internet lento bajalo a `"1200k"`.

## Qué hace cada archivo

| Archivo | Para qué sirve |
| --- | --- |
| `iniciar-camara.cmd` | Arranca todo (doble clic). |
| `detener-camara.cmd` | Cierra el servidor, FFmpeg y el túnel. |
| `server.mjs` | Toma la webcam, genera HLS y sirve `/snapshot`. |
| `config.json` | Cámara, resolución y puerto. |
| `bin/` | FFmpeg y cloudflared descargados (se puede borrar). |
| `hls/` | Segmentos temporales del stream (se regeneran solos). |
| `url-publica.txt` | URL del túnel que está activo (se reescribe en cada arranque). |
| `cloudflared-*.log` | Log de cada intento de túnel (se guardan los últimos 5). |

## Endpoints del servidor

| Ruta | Descripción |
| --- | --- |
| `/` | Página para ver la cámara en la PC. |
| `/live.m3u8` | Stream HLS que reproduce la app. |
| `/snapshot` | Foto JPEG del momento (capturas). |
| `/estado` | Estado en JSON (cámara, último segmento, errores). |

## Problemas comunes

**"No se encontró ninguna cámara"**
Cerrá otras apps que usen la webcam (Zoom, Teams, Cámara de Windows) y volvé
a intentar.

**La app queda en "CONECTANDO"**
- Revisá que la ventana de la PC siga abierta y diga "Cámara lista".
- Abrí la URL en el navegador del celular: si tampoco carga, el problema es
  la PC o el túnel, no la app.
- Reiniciá `iniciar-camara.cmd` y volvé a pegar la URL nueva.

**"Cloudflare se cerró"**
Se cortó el túnel. Cerrá la ventana y volvé a iniciar; la URL va a cambiar.

**Se ve con varios segundos de atraso**
Es normal en HLS (2 a 5 segundos). Para vigilancia alcanza. Si necesitás
menos latencia habría que pasar a WebRTC, que requiere otro reproductor.

**El puerto 8090 está ocupado**
El script cierra el servidor anterior automáticamente. Si el puerto lo usa
otro programa, cambiá `puerto` en `config.json`.

## Seguridad

Cualquiera que tenga la URL pública puede ver la cámara mientras el servidor
esté corriendo. Usalo solo durante la demo o mientras lo necesites y cerrá la
ventana después.
