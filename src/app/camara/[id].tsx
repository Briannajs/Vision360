import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video"; // Nueva librería
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../theme/colors";

// URL de prueba - luego reemplazar con la Geotek GT N1
const STREAM_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export default function CamaraScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Configurar el reproductor de expo-video
  const player = useVideoPlayer(STREAM_URL, (player) => {
    player.loop = true;
    player.play();
  });

  // Actualizar la hora cada segundo
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCapturar = async () => {
    setIsRecording(true);
    Alert.alert("Captura", "Capturando pantalla...");
    // Aquí iría la lógica real para tomar una foto del video
    setTimeout(() => {
      setIsRecording(false);
      Alert.alert("Éxito", "Captura guardada en tu galería");
    }, 1500);
  };

  return (
    <View style={styles.container}>
      {/* Reproductor de video con expo-video */}
      <VideoView
        style={styles.video}
        player={player}
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="cover"
      />

      {/* Header superior */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="log-out-outline" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.camName}>CAM 03</Text>
          <View style={styles.recordingDot} />
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.dateText}>
            {currentTime.toLocaleDateString("es-AR")},{" "}
            {currentTime.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text style={styles.locationText}>Barrio Uriburu,</Text>
          <Text style={styles.locationText}>Resistencia Chaco</Text>
        </View>
      </View>

      {/* Botón de captura */}
      <TouchableOpacity
        style={styles.captureButton}
        onPress={handleCapturar}
        disabled={isRecording}
      >
        <Text style={styles.captureButtonText}>
          {isRecording ? "CAPTURANDO..." : "CAPTURAR PANTALLA"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { ...StyleSheet.absoluteFill },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "rgba(211, 47, 47, 0.4)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  camName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 15,
    letterSpacing: 1,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  headerRight: { alignItems: "flex-end" },
  dateText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  locationText: {
    color: COLORS.text,
    fontSize: 12,
    textAlign: "right",
  },

  captureButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 5,
  },
  captureButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 1.5,
  },
});
