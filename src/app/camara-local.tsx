import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ES_WEB = Platform.OS === "web";

function dosDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}

function formatearFecha(fecha: Date) {
  const dia = fecha.toLocaleDateString("es-AR");
  const hora = fecha.toLocaleTimeString("es-AR", { hour12: false });
  return `${dia} ${hora}`;
}

function nombreArchivo(fecha: Date) {
  const dia = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
  const hora = `${dosDigitos(fecha.getHours())}-${dosDigitos(fecha.getMinutes())}-${dosDigitos(fecha.getSeconds())}`;
  return `vision360_${dia}_${hora}.png`;
}

function normalizarDataUrl(raw: string) {
  if (!raw) throw new Error("La cámara no devolvió la imagen");
  return raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${raw}`;
}

/**
 * Toma la foto de la webcam, le dibuja la fecha y hora encima
 * y la descarga como PNG. Solo se ejecuta en la versión web.
 */
async function descargarCaptura(raw: string, fecha: Date) {
  const dataUrl = normalizarDataUrl(raw);

  const imagen = new window.Image();
  await new Promise<void>((resolve, reject) => {
    imagen.onload = () => resolve();
    imagen.onerror = () => reject(new Error("No se pudo procesar la captura"));
    imagen.src = dataUrl;
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
  enlace.download = nombreArchivo(fecha);
  enlace.click();
}

type Aviso = { tipo: "ok" | "error"; texto: string };

export default function CamaraLocalScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">(
    ES_WEB ? "front" : "back",
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [capturando, setCapturando] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ultimaCaptura, setUltimaCaptura] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // El aviso de la captura desaparece solo.
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const capturarImagen = async () => {
    if (!cameraRef.current || capturando) return;

    setCapturando(true);
    setAviso(null);

    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: ES_WEB,
        imageType: "jpg",
      });

      if (!foto) throw new Error("La cámara no devolvió la imagen");

      const ahora = new Date();
      const dataUrl = normalizarDataUrl(foto.base64 || foto.uri);

      if (ES_WEB) {
        await descargarCaptura(dataUrl, ahora);
        setUltimaCaptura(dataUrl);
        setAviso({
          tipo: "ok",
          texto: "Captura descargada como PNG, con fecha y hora.",
        });
      } else {
        const { requestPermissionsAsync, saveToLibraryAsync } = await import(
          "expo-media-library/legacy"
        );
        const permiso = await requestPermissionsAsync(true);

        if (!permiso.granted) {
          throw new Error(
            "Habilitá el acceso a la galería para guardar la captura.",
          );
        }

        await saveToLibraryAsync(foto.uri);
        setUltimaCaptura(foto.uri);
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

  const reintentarCamara = () => {
    setCamaraLista(false);
    setErrorCamara(null);
    setIntento((valor) => valor + 1);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="videocam-outline" size={80} color={COLORS.textMuted} />
        <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
        <Text style={styles.permissionText}>
          {ES_WEB
            ? "El navegador necesita permiso para usar la webcam. Aceptá el aviso que aparece en la barra de direcciones y volvé a intentar."
            : "Visión360 necesita la cámara para mostrar la vigilancia en vivo."}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>PERMITIR CÁMARA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={styles.backLinkText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        key={intento}
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        animateShutter={false}
        onCameraReady={() => setCamaraLista(true)}
        onMountError={({ message }) => setErrorCamara(message)}
      />

      {/* Barra superior */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>CÁMARA EN VIVO</Text>
        <View style={styles.topButton} />
      </View>

      {/* Estado de la cámara */}
      <View style={styles.camInfo}>
        <View
          style={[
            styles.recordingDot,
            !camaraLista && { backgroundColor: COLORS.textDim },
          ]}
        />
        <Text style={styles.camName}>
          {camaraLista ? "EN VIVO" : "CONECTANDO"}
        </Text>
      </View>

      {/* Fecha y hora */}
      <View style={styles.locationInfo}>
        <Text style={styles.locationText}>{formatearFecha(currentTime)}</Text>
        <Text style={styles.locationSub}>Resistencia, Chaco</Text>
      </View>

      {/* Aviso de captura */}
      {aviso && (
        <View
          style={[
            styles.aviso,
            aviso.tipo === "error" ? styles.avisoError : styles.avisoOk,
          ]}
        >
          <Ionicons
            name={
              aviso.tipo === "error" ? "alert-circle" : "checkmark-circle"
            }
            size={18}
            color={COLORS.text}
          />
          <Text style={styles.avisoText}>{aviso.texto}</Text>
        </View>
      )}

      {/* Cargando / error de cámara */}
      {!camaraLista && !errorCamara && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <ActivityIndicator color={COLORS.text} />
          <Text style={styles.overlayText}>Conectando cámara...</Text>
        </View>
      )}

      {errorCamara && (
        <View style={styles.overlayCenter}>
          <Ionicons name="warning-outline" size={48} color={COLORS.warning} />
          <Text style={styles.overlayTitle}>No se pudo abrir la cámara</Text>
          <Text style={styles.overlayText}>{errorCamara}</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={reintentarCamara}
          >
            <Text style={styles.permissionButtonText}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cambiar cámara (solo en el celular) */}
      {!ES_WEB && (
        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setFacing(facing === "back" ? "front" : "back")}
        >
          <Ionicons
            name="camera-reverse-outline"
            size={28}
            color={COLORS.text}
          />
        </TouchableOpacity>
      )}

      {/* Última captura */}
      {ultimaCaptura && (
        <View style={styles.thumbBox}>
          <Text style={styles.thumbLabel}>ÚLTIMA CAPTURA</Text>
          <Image source={{ uri: ultimaCaptura }} style={styles.thumb} />
        </View>
      )}

      {/* Pie con el botón de captura */}
      <View style={[styles.footer, { bottom: 24 + insets.bottom }]}>
        <Text style={styles.hint}>
          {ES_WEB
            ? "La captura se descarga como PNG con la fecha y hora."
            : "La captura se guarda en la galería del teléfono."}
        </Text>
        <TouchableOpacity
          style={[
            styles.captureButton,
            (!camaraLista || capturando) && styles.disabled,
          ]}
          onPress={capturarImagen}
          disabled={!camaraLista || capturando}
        >
          {capturando ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="camera" size={22} color={COLORS.text} />
              <Text style={styles.captureButtonText}>CAPTURAR</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  permissionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 20,
  },
  permissionText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 10,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 22,
  },
  permissionButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 1,
  },
  backLink: { marginTop: 18, padding: 8 },
  backLinkText: { color: COLORS.textMuted, fontSize: 13 },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: "rgba(12, 16, 26, 0.75)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingBottom: 12,
  },
  topButton: { width: 32, alignItems: "flex-start" },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
  },

  camInfo: {
    position: "absolute",
    top: 96,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  camName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },

  locationInfo: {
    position: "absolute",
    top: 94,
    right: 20,
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  locationSub: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },

  aviso: {
    position: "absolute",
    top: 145,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  avisoOk: { backgroundColor: "rgba(67, 160, 71, 0.92)" },
  avisoError: { backgroundColor: "rgba(229, 57, 53, 0.92)" },
  avisoText: {
    color: COLORS.text,
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  overlayCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 9, 18, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  overlayTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 12,
  },
  overlayText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  switchButton: {
    position: "absolute",
    top: 145,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },

  thumbBox: {
    position: "absolute",
    bottom: 120,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  thumbLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  thumb: { width: 96, height: 64, borderRadius: 4 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 190,
    justifyContent: "center",
  },
  captureButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  disabled: { opacity: 0.5 },
});
