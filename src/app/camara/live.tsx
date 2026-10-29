import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  guardarUrlCamara,
  leerUrlCamara,
  urlPorDefecto,
  urlsCamara,
} from "../../services/camara";
import { COLORS } from "../../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ES_WEB = Platform.OS === "web";

type Aviso = { tipo: "ok" | "error"; texto: string };

function dosDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}

function formatearFecha(fecha: Date) {
  return `${fecha.toLocaleDateString("es-AR")} ${fecha.toLocaleTimeString("es-AR", {
    hour12: false,
  })}`;
}

function nombreArchivo(fecha: Date, extension: string) {
  const dia = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(
    fecha.getDate()
  )}`;
  const hora = `${dosDigitos(fecha.getHours())}-${dosDigitos(
    fecha.getMinutes()
  )}-${dosDigitos(fecha.getSeconds())}`;
  return `vision360_${dia}_${hora}.${extension}`;
}

/**
 * Descarga la captura como PNG con la fecha y hora dibujadas encima.
 * Solo se usa en la versión web.
 */
async function descargarCaptura(blob: Blob, fecha: Date) {
  const url = URL.createObjectURL(blob);

  try {
    const imagen = new window.Image();
    await new Promise<void>((resolver, rechazar) => {
      imagen.onload = () => resolver();
      imagen.onerror = () => rechazar(new Error("No se pudo procesar la captura"));
      imagen.src = url;
    });

    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no soporta canvas");

    ctx.drawImage(imagen, 0, 0, ancho, alto);

    const escala = Math.max(1, ancho / 1280);
    const fontSize = Math.round(20 * escala);
    const pad = Math.round(12 * escala);
    const texto = `Vision360  ${formatearFecha(fecha)}`;

    ctx.font = `bold ${fontSize}px monospace`;
    const anchoTexto = ctx.measureText(texto).width;
    const altoBarra = fontSize + pad;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, alto - altoBarra, anchoTexto + pad * 2, altoBarra);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, pad, alto - altoBarra / 2);

    const enlace = document.createElement("a");
    enlace.href = canvas.toDataURL("image/png");
    enlace.download = nombreArchivo(fecha, "png");
    enlace.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CamaraLiveScreen() {
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState("");
  const [borrador, setBorrador] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [reloj, setReloj] = useState(new Date());
  const [intento, setIntento] = useState(0);

  const urls = useMemo(() => urlsCamara(base), [base]);

  const player = useVideoPlayer(null, (instancia) => {
    instancia.loop = false;
    instancia.muted = true;
  });

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const { isPlaying: playing } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  useEffect(() => {
    let activo = true;

    (async () => {
      const guardada = await leerUrlCamara();
      if (!activo) return;
      const inicial = guardada || urlPorDefecto();
      setBase(inicial);
      setBorrador(inicial);
      setCargando(false);
    })();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(timer);
  }, [aviso]);

  // En web se muestra la página del servidor en un iframe, porque los
  // navegadores de escritorio no reproducen HLS de forma nativa.
  useEffect(() => {
    if (ES_WEB || !urls.hls) return;

    let cancelado = false;

    (async () => {
      try {
        await player.replaceAsync(urls.hls);
        if (!cancelado) player.play();
      } catch (error: any) {
        if (!cancelado) {
          setAviso({
            tipo: "error",
            texto: error?.message || "No se pudo conectar con la cámara.",
          });
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [player, urls.hls, intento]);

  // Si el video se corta solo (un segmento que llega tarde, un bache de red),
  // se reconecta sin que haya que tocar REINTENTAR. Después de 5 intentos
  // queda la pantalla de error para reintentar a mano.
  const reintentosAuto = useRef(0);

  useEffect(() => {
    if (ES_WEB || !urls.hls || editando) return;

    if (status === "readyToPlay") {
      reintentosAuto.current = 0;
      return;
    }

    if (status !== "error") return;
    if (reintentosAuto.current >= 5) return;

    const timer = setTimeout(() => {
      reintentosAuto.current += 1;
      setIntento((valor) => valor + 1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [status, editando, urls.hls]);

  const guardarUrl = async () => {
    const nueva = borrador.trim();

    if (nueva && !/^https?:\/\//i.test(nueva)) {
      setAviso({
        tipo: "error",
        texto: "La URL tiene que empezar con http:// o https://",
      });
      return;
    }

    await guardarUrlCamara(nueva);
    setBase(nueva);
    setEditando(false);
    setIntento((valor) => valor + 1);
    setAviso(
      nueva
        ? { tipo: "ok", texto: "Cámara configurada. Conectando..." }
        : null
    );
  };

  const capturar = async () => {
    if (!urls.snapshot || capturando) return;

    setCapturando(true);
    setAviso(null);

    try {
      const ahora = new Date();
      const urlCaptura = `${urls.snapshot}?t=${Date.now()}`;

      if (ES_WEB) {
        const respuesta = await fetch(urlCaptura);
        if (!respuesta.ok) {
          throw new Error(
            respuesta.status === 503
              ? "La cámara todavía no está transmitiendo."
              : `El servidor respondió ${respuesta.status}.`
          );
        }

        await descargarCaptura(await respuesta.blob(), ahora);
        setAviso({
          tipo: "ok",
          texto: "Captura descargada como PNG con fecha y hora.",
        });
      } else {
        const { File, Paths } = await import("expo-file-system");
        const destino = new File(Paths.cache, nombreArchivo(ahora, "jpg"));
        const archivo = await File.downloadFileAsync(urlCaptura, destino, {
          idempotent: true,
        });

        const { requestPermissionsAsync, saveToLibraryAsync } = await import(
          "expo-media-library/legacy"
        );
        const permiso = await requestPermissionsAsync(true);

        if (!permiso.granted) {
          throw new Error("Habilitá el acceso a la galería para guardar la captura.");
        }

        await saveToLibraryAsync(archivo.uri);
        setAviso({ tipo: "ok", texto: "Captura guardada en la galería." });
      }
    } catch (error: any) {
      setAviso({
        tipo: "error",
        texto: error?.message || "No se pudo capturar la imagen.",
      });
    } finally {
      setCapturando(false);
    }
  };

  const mostrarConfiguracion = !base || editando;
  const enVivo = !ES_WEB && status === "readyToPlay" && playing;

  /** Abre el formulario con la dirección actual: siempre se puede cambiar. */
  const abrirConfiguracion = () => {
    setBorrador(base);
    setEditando(true);
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      {!mostrarConfiguracion &&
        (ES_WEB ? (
          <View style={styles.video}>
            {createElement("iframe", {
              src: urls.pagina,
              title: "Cámara en vivo",
              style: {
                border: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
              },
            })}
          </View>
        ) : (
          <VideoView
            style={styles.video}
            player={player}
            contentFit="contain"
            nativeControls={false}
          />
        ))}

      {mostrarConfiguracion && (
        <View style={styles.configuracion}>
          <Ionicons name="videocam-outline" size={60} color={COLORS.primary} />
          <Text style={styles.configTitulo}>
            {base ? "Cambiar la cámara" : "Conectar la cámara"}
          </Text>
          <Text style={styles.configTexto}>
            1. En la PC, abrí la carpeta {"`camara`"} y ejecutá{" "}
            <Text style={styles.configCodigo}>iniciar-camara.cmd</Text>.
            {"\n"}2. Esperá a que aparezca la <Text style={styles.configFuerte}>URL PÚBLICA</Text>.
            {"\n"}3. Pegala acá abajo y tocá GUARDAR.
          </Text>

          <TextInput
            style={styles.input}
            value={borrador}
            onChangeText={setBorrador}
            placeholder="https://algo.trycloudflare.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <TouchableOpacity style={styles.botonGuardar} onPress={guardarUrl}>
            <Text style={styles.botonTexto}>GUARDAR</Text>
          </TouchableOpacity>

          {base ? (
            <TouchableOpacity
              style={styles.enlaceSecundario}
              onPress={() => setEditando(false)}
            >
              <Text style={styles.enlaceSecundarioTexto}>Cancelar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.enlaceSecundario}
              onPress={() => router.push("/camara-local" as any)}
            >
              <Text style={styles.enlaceSecundarioTexto}>
                Usar la cámara de este dispositivo
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Barra superior */}
      <View style={styles.barraSuperior}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonIcono}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.tituloBarra}>CÁMARA EN VIVO</Text>
        <TouchableOpacity
          onPress={() => {
            if (editando) setEditando(false);
            else abrirConfiguracion();
          }}
          style={styles.botonIcono}
          accessibilityLabel={
            editando
              ? "Cerrar la configuración"
              : "Cambiar la dirección de la cámara"
          }
        >
          <Ionicons
            name={editando && base ? "close" : "settings-outline"}
            size={22}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Estado y reloj */}
      {!mostrarConfiguracion && (
        <>
          <View style={styles.estado}>
            <View
              style={[
                styles.punto,
                !enVivo && { backgroundColor: COLORS.textDim },
              ]}
            />
            <Text style={styles.estadoTexto}>
              {ES_WEB
                ? "EN VIVO"
                : status === "error"
                  ? "SIN SEÑAL"
                  : enVivo
                    ? "EN VIVO"
                    : "CONECTANDO"}
            </Text>
          </View>

          {!ES_WEB && (
            <View style={styles.reloj}>
              <Text style={styles.relojTexto}>{formatearFecha(reloj)}</Text>
              <Text style={styles.relojSub}>Visión360</Text>
            </View>
          )}

          {!ES_WEB && status === "error" && (
            <View style={styles.errorCapa}>
              <Ionicons name="warning-outline" size={44} color={COLORS.warning} />
              <Text style={styles.errorTitulo}>No se pudo conectar</Text>
              <Text style={styles.errorTexto}>
                Verificá que la PC esté encendida, que la cámara esté transmitiendo
                y que la URL sea la correcta.
              </Text>
              <TouchableOpacity
                style={styles.botonGuardar}
                onPress={() => {
                  reintentosAuto.current = 0;
                  setIntento((valor) => valor + 1);
                }}
              >
                <Text style={styles.botonTexto}>REINTENTAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.enlaceSecundario}
                onPress={abrirConfiguracion}
              >
                <Text style={styles.enlaceSecundarioTexto}>
                  Cambiar la dirección de la cámara
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Aviso */}
      {aviso && (
        <View
          style={[
            styles.aviso,
            aviso.tipo === "error" ? styles.avisoError : styles.avisoOk,
          ]}
        >
          <Ionicons
            name={aviso.tipo === "error" ? "alert-circle" : "checkmark-circle"}
            size={18}
            color={COLORS.text}
          />
          <Text style={styles.avisoTexto}>{aviso.texto}</Text>
        </View>
      )}

      {/* Pie con captura */}
      {!mostrarConfiguracion && (
        <View style={[styles.pie, { bottom: 24 + insets.bottom }]}>
          <Text style={styles.pista}>
            La captura se guarda con la fecha y hora del momento.
          </Text>
          <TouchableOpacity
            style={[styles.botonCaptura, capturando && styles.deshabilitado]}
            onPress={capturar}
            disabled={capturando}
          >
            {capturando ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="camera" size={22} color={COLORS.text} />
                <Text style={styles.botonCapturaTexto}>CAPTURAR</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonCambiarUrl}
            onPress={abrirConfiguracion}
          >
            <Ionicons name="link-outline" size={15} color={COLORS.textMuted} />
            <Text style={styles.botonCambiarUrlTexto}>
              Cambiar dirección de la cámara
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1 },
  centro: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  configuracion: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 90,
    paddingBottom: 40,
    backgroundColor: COLORS.background,
  },
  configTitulo: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 16,
  },
  configTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 22,
  },
  configCodigo: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  configFuerte: { color: COLORS.text, fontWeight: "700" },
  input: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  botonGuardar: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginTop: 18,
  },
  botonTexto: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  enlaceSecundario: { marginTop: 18, padding: 8 },
  enlaceSecundarioTexto: { color: COLORS.textMuted, fontSize: 13 },

  barraSuperior: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 88,
    paddingTop: 42,
    paddingHorizontal: 15,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(12, 16, 26, 0.72)",
  },
  botonIcono: { padding: 6 },
  tituloBarra: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
  },

  estado: {
    position: "absolute",
    top: 100,
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  punto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2ee66b",
    marginRight: 8,
  },
  estadoTexto: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  reloj: {
    position: "absolute",
    top: 98,
    right: 18,
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  relojTexto: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  relojSub: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

  errorCapa: {
    position: "absolute",
    top: 88,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 9, 18, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  errorTitulo: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 12,
  },
  errorTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },

  aviso: {
    position: "absolute",
    top: 145,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  avisoOk: { backgroundColor: "rgba(67, 160, 71, 0.92)" },
  avisoError: { backgroundColor: "rgba(229, 57, 53, 0.92)" },
  avisoTexto: {
    color: COLORS.text,
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  pie: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pista: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  botonCaptura: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 190,
    justifyContent: "center",
  },
  botonCapturaTexto: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  botonCambiarUrl: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(139, 149, 168, 0.35)",
  },
  botonCambiarUrlTexto: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },
  deshabilitado: { opacity: 0.5 },
});
