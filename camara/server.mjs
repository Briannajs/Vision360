/**
 * Servidor de cámara de Visión360.
 *
 * Toma una webcam conectada a la PC, la convierte a HLS con FFmpeg
 * y publica:
 *   - /live.m3u8   -> stream en vivo para la app (expo-video)
 *   - /snapshot    -> una foto JPEG del momento (capturas)
 *   - /estado      -> estado del servicio en JSON
 *   - /            -> página simple para ver la cámara en la PC
 *
 * Se inicia con `camara\iniciar-camara.cmd`. No graba video.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(AQUI, "bin");
const HLS = path.join(AQUI, "hls");
const FFMPEG = path.join(BIN, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

function leerConfig() {
  const archivo = path.join(AQUI, "config.json");
  const base = {
    camara: "HD 2MP WEBCAM",
    puerto: 8090,
    ancho: 1280,
    fps: 25,
    bitrate: "2500k",
  };
  if (!existsSync(archivo)) return base;
  try {
    // Windows PowerShell guarda el JSON con BOM: lo sacamos antes de parsear.
    const texto = readFileSync(archivo, "utf8").replace(/^\uFEFF/, "");
    return { ...base, ...JSON.parse(texto) };
  } catch (error) {
    console.warn(`[config] no se pudo leer config.json: ${error.message}`);
    return base;
  }
}

const config = leerConfig();
const PUERTO = Number(config.puerto) || 8090;
const ANCHO = Number(config.ancho) || 1280;
const FPS = Number(config.fps) || 25;
const BITRATE = config.bitrate || "2500k";

if (!existsSync(FFMPEG)) {
  console.error(`No se encontró FFmpeg en ${FFMPEG}`);
  console.error("Ejecutá camara\\iniciar-camara.cmd para descargarlo.");
  process.exit(1);
}

if (existsSync(HLS)) {
  // Arrancamos con la carpeta limpia para no servir segmentos viejos.
  rmSync(HLS, { recursive: true, force: true });
}
mkdirSync(HLS, { recursive: true });

let ffmpeg = null;
let deteniendo = false;
let reinicios = 0;
let ultimoError = "";
let ultimaCaptura = null;

function argumentosFFmpeg() {
  const entrada =
    process.platform === "win32"
      ? ["-f", "dshow", "-rtbufsize", "512M", "-i", `video=${config.camara}`]
      : ["-f", "v4l2", "-i", config.camara];

  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    ...entrada,
    "-vf",
    `scale=${ANCHO}:-2`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-g",
    String(FPS),
    "-keyint_min",
    String(FPS),
    "-sc_threshold",
    "0",
    "-b:v",
    BITRATE,
    "-maxrate",
    BITRATE,
    "-bufsize",
    "5000k",
    "-pix_fmt",
    "yuv420p",
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "15",
    // Margen extra: FFmpeg borra los segmentos recién cuando salieron
    // varios de la lista. Con ventanas cortas el celular pedía un
    // segmento ya borrado, recibía 404 y el reproductor se detenía.
    "-hls_delete_threshold",
    "4",
    "-hls_flags",
    "delete_segments+append_list+omit_endlist+independent_segments",
    "-hls_segment_filename",
    path.join(HLS, "seg_%05d.ts"),
    path.join(HLS, "live.m3u8"),
  ];
}

function iniciarFFmpeg() {
  if (deteniendo) return;

  console.log(`[camara] abriendo "${config.camara}" a ${ANCHO}px / ${FPS}fps`);
  ffmpeg = spawn(FFMPEG, argumentosFFmpeg(), { windowsHide: true });

  ffmpeg.stderr.on("data", (datos) => {
    for (const linea of datos.toString().split(/\r?\n/)) {
      const texto = linea.trim();
      if (!texto || /deprecated pixel format|swscaler|deprecated pixel/i.test(texto)) continue;
      ultimoError = texto.slice(0, 400);
      console.warn(`[ffmpeg] ${ultimoError}`);
    }
  });

  ffmpeg.on("exit", (codigo) => {
    ffmpeg = null;
    if (deteniendo) return;
    reinicios += 1;
    const espera = Math.min(15000, 2000 * reinicios);
    console.warn(
      `[camara] FFmpeg terminó (código ${codigo}). Reintentando en ${espera / 1000}s...`
    );
    setTimeout(iniciarFFmpeg, espera).unref();
  });
}

function detener() {
  deteniendo = true;
  if (ffmpeg) {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", detener);
process.on("SIGTERM", detener);

/* ------------------------------------------------------------------ */
/* Capturas                                                            */
/* ------------------------------------------------------------------ */

let capturando = false;

function tomarCaptura() {
  return new Promise((resolve, reject) => {
    if (capturando) {
      reject(new Error("Ya hay una captura en curso"));
      return;
    }
    if (!existsSync(path.join(HLS, "live.m3u8"))) {
      reject(new Error("La cámara todavía no está transmitiendo"));
      return;
    }

    capturando = true;
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      `http://127.0.0.1:${PUERTO}/live.m3u8`,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "pipe:1",
    ];

    const proceso = spawn(FFMPEG, args, { windowsHide: true });
    const trozos = [];
    let terminado = false;

    const limite = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      try {
        proceso.kill("SIGKILL");
      } catch {}
      capturando = false;
      reject(new Error("La captura tardó demasiado"));
    }, 12000);

    proceso.stdout.on("data", (dato) => trozos.push(dato));
    proceso.stderr.on("data", () => {});

    proceso.on("error", (error) => {
      clearTimeout(limite);
      capturando = false;
      reject(error);
    });

    proceso.on("exit", () => {
      clearTimeout(limite);
      capturando = false;
      if (terminado) return;
      const imagen = Buffer.concat(trozos);
      if (!imagen.length) {
        reject(new Error("No se pudo obtener la imagen de la cámara"));
        return;
      }
      resolve(imagen);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Servidor HTTP                                                       */
/* ------------------------------------------------------------------ */

const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visión360 · Cámara en vivo</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #05070d; color: #fff; font-family: system-ui, sans-serif; }
  .marco { position: relative; max-width: 1100px; margin: 0 auto; }
  video { display: block; width: 100%; background: #000; }
  .capa { position: absolute; left: 0; right: 0; top: 0; display: flex; justify-content: space-between;
          padding: 14px 18px; background: linear-gradient(#000a, transparent); font-size: 14px; }
  .vivo { display: flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: 1px; }
  .punto { width: 10px; height: 10px; border-radius: 50%; background: #2ee66b; }
  .barra { display: flex; justify-content: space-between; align-items: center; gap: 12px;
           padding: 14px 18px; flex-wrap: wrap; }
  .reloj { font-variant-numeric: tabular-nums; color: #cfd6e4; }
  button { background: #208AEF; color: #fff; border: 0; border-radius: 999px;
           padding: 12px 26px; font-weight: 700; letter-spacing: 1px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .nota { color: #8b94a7; font-size: 12px; line-height: 1.5; padding: 0 18px 18px; }
  code { background: #121a2a; padding: 2px 6px; border-radius: 4px; }
  body.embed { height: 100vh; overflow: hidden; }
  body.embed .marco { max-width: none; height: 100vh; }
  body.embed .barra, body.embed .nota { display: none; }
  body.embed video { height: 100vh; object-fit: contain; }
</style>
</head>
<body>
  <div class="marco">
    <div style="position:relative">
      <video id="video" playsinline muted autoplay></video>
      <div class="capa">
        <div class="vivo"><span class="punto"></span> EN VIVO</div>
        <div id="reloj"></div>
      </div>
    </div>
    <div class="barra">
      <div class="reloj" id="estado">Conectando...</div>
      <button id="capturar">CAPTURAR</button>
    </div>
    <p class="nota">
      Esta página es solo para probar la cámara en la PC. En el celular usá la app:
      <code>Mi Barrio → Cámara en vivo</code>.
    </p>
  </div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script>
  const video = document.getElementById('video');
  const estado = document.getElementById('estado');
  const reloj = document.getElementById('reloj');

  if (new URLSearchParams(location.search).has('embed')) {
    document.body.classList.add('embed');
  }

  function relojAhora() {
    const ahora = new Date();
    reloj.textContent = ahora.toLocaleDateString('es-AR') + ' ' +
      ahora.toLocaleTimeString('es-AR', { hour12: false });
  }
  relojAhora();
  setInterval(relojAhora, 1000);

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = 'live.m3u8';
  } else if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2 });
    hls.loadSource('live.m3u8');
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_, datos) => {
      if (datos.fatal) estado.textContent = 'Error de conexión, reintentando...';
    });
  } else {
    estado.textContent = 'Este navegador no puede reproducir HLS.';
  }

  video.addEventListener('playing', () => { estado.textContent = 'Transmitiendo'; });
  video.addEventListener('waiting', () => { estado.textContent = 'Cargando...'; });

  const boton = document.getElementById('capturar');
  boton.addEventListener('click', () => {
    boton.disabled = true;
    boton.textContent = 'GUARDANDO...';
    const enlace = document.createElement('a');
    enlace.href = 'snapshot?t=' + Date.now();
    enlace.download = 'vision360_' + Date.now() + '.jpg';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => { boton.disabled = false; boton.textContent = 'CAPTURAR'; }, 1500);
  });
</script>
</body>
</html>`;

function responder(res, codigo, tipo, cuerpo, extra = {}) {
  res.writeHead(codigo, {
    "Content-Type": tipo,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store",
    ...extra,
  });
  res.end(cuerpo);
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function servirArchivo(res, archivo, tipo) {
  // FFmpeg reescribe el m3u8 y rota segmentos justo mientras se sirven.
  // Si el archivo no está en ese instante, se reintenta en lugar de
  // devolver 404/503: el reproductor lo toma como error fatal y se corta.
  let contenido = null;
  for (let intento = 0; intento < 6; intento++) {
    try {
      contenido = readFileSync(archivo);
      if (contenido.length > 0) break;
    } catch {}
    contenido = null;
    await esperar(80);
  }

  if (!contenido || contenido.length === 0) {
    responder(res, 404, "text/plain; charset=utf-8", "No disponible");
    return;
  }

  res.writeHead(200, {
    "Content-Type": tipo,
    "Content-Length": contenido.length,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(contenido);
}

function estadoActual() {
  const segmentos = readdirSync(HLS).filter((n) => n.endsWith(".ts"));
  const reciente = segmentos
    .map((n) => ({
      nombre: n,
      modificado: statSync(path.join(HLS, n)).mtimeMs,
    }))
    .sort((a, b) => b.modificado - a.modificado)[0];

  return {
    camara: config.camara,
    transmitiendo: Boolean(ffmpeg) && Boolean(reciente),
    ultimoSegmentoHaceMs: reciente ? Date.now() - reciente.modificado : null,
    reinicios,
    ultimoError: ultimoError || null,
    hls: "/live.m3u8",
    snapshot: "/snapshot",
  };
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    responder(res, 204, "text/plain");
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const ruta = url.pathname;

  if (ruta === "/" || ruta === "/index.html") {
    responder(res, 200, "text/html; charset=utf-8", PAGINA);
    return;
  }

  if (ruta === "/live.m3u8") {
    await servirArchivo(res, path.join(HLS, "live.m3u8"), "application/vnd.apple.mpegurl");
    return;
  }

  if (/^\/seg_\d+\.ts$/.test(ruta)) {
    await servirArchivo(res, path.join(HLS, ruta.slice(1)), "video/mp2t");
    return;
  }

  if (ruta === "/snapshot" || ruta === "/snapshot.jpg") {
    try {
      const imagen = await tomarCaptura();
      ultimaCaptura = new Date();
      responder(res, 200, "image/jpeg", imagen, {
        "Content-Disposition": `inline; filename="vision360_${ultimaCaptura
          .toISOString()
          .replace(/[:.]/g, "-")}.jpg"`,
      });
    } catch (error) {
      responder(res, 503, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (ruta === "/estado") {
    responder(res, 200, "application/json; charset=utf-8", JSON.stringify(estadoActual()));
    return;
  }

  responder(res, 404, "text/plain; charset=utf-8", "No encontrado");
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  console.log(`[server] cámara disponible en http://localhost:${PUERTO}`);
  console.log(`[server] stream HLS:  http://localhost:${PUERTO}/live.m3u8`);
  console.log(`[server] captura:     http://localhost:${PUERTO}/snapshot`);
  iniciarFFmpeg();
});
