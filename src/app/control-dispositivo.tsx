import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlarmaActual,
  ComandoHardware,
  enviarComandoHardware,
  obtenerAlarmaActual,
} from "../services/hardware";
import { COLORS } from "../theme/colors";

const NOMBRES_TIPO: Record<string, string> = {
  panico: "PÁNICO",
  incendio: "INCENDIO",
  emergencia: "EMERGENCIA",
};

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ControlDispositivoScreen() {
  const [alarma, setAlarma] = useState<AlarmaActual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<ComandoHardware | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerAlarmaActual();
      setAlarma(data);
      setError(null);
    } catch (e: any) {
      setError(
        e.message ||
          "No se pudo leer la alarma. ¿Ejecutaste supabase/esp32.sql?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Diferido para no llamar setState durante el render inicial.
    const inicio = setTimeout(cargar, 0);
    const timer = setInterval(cargar, 5000);
    return () => {
      clearTimeout(inicio);
      clearInterval(timer);
    };
  }, [cargar]);

  const ejecutar = async (comando: ComandoHardware) => {
    if (!alarma?.id_evento) return;

    setEnviando(comando);
    try {
      await enviarComandoHardware(alarma.id_evento, comando);
      setAlarma({
        ...alarma,
        estado_alarma: comando === "detener" ? "detenida" : "silenciada",
      });
      Alert.alert(
        comando === "detener" ? "⏹ Alarma detenida" : "🔇 Buzzer silenciado",
        comando === "detener"
          ? "El ESP32 va a apagar el buzzer, el LED y el relay en unos segundos."
          : "El ESP32 va a apagar el sonido. El LED y el relay siguen activos.",
      );
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo enviar el comando");
    } finally {
      setEnviando(null);
    }
  };

  const silenciada = alarma?.estado_alarma === "silenciada";
  const detenida = alarma?.estado_alarma === "detenida";
  const sinAlarma = !alarma || detenida;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Alarma</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Ionicons name="warning" size={34} color={COLORS.warning} />
          <Text style={styles.cardTitle}>Sin conexión con la base</Text>
          <Text style={styles.cardText}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.row}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: sinAlarma
                      ? COLORS.textDim
                      : silenciada
                        ? COLORS.warning
                        : COLORS.success,
                  },
                ]}
              />
              <Text style={styles.cardTitle}>
                {sinAlarma ? "Sin alarma activa" : "Alarma en curso"}
              </Text>
            </View>

            {alarma ? (
              <>
                <Text style={styles.cardText}>
                  {NOMBRES_TIPO[alarma.tipo] || alarma.tipo.toUpperCase()} ·{" "}
                  {formatearFecha(alarma.fecha_hora)}
                </Text>
                <Text style={styles.cardText}>
                  Estado:{" "}
                  <Text
                    style={{
                      color: detenida
                        ? COLORS.textDim
                        : silenciada
                          ? COLORS.warning
                          : COLORS.success,
                      fontWeight: "bold",
                    }}
                  >
                    {(alarma.estado_alarma || "activa").toUpperCase()}
                  </Text>
                </Text>
              </>
            ) : (
              <Text style={styles.cardText}>
                Todavía no se registró ninguna alarma. Disparalá desde los
                botones de emergencia.
              </Text>
            )}

            <Text style={styles.cardHint}>
              El ESP32 consulta la nube cada 2 segundos. Los comandos pueden
              tardar unos segundos en llegar.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: COLORS.primary },
              (enviando !== null || sinAlarma) && styles.disabled,
            ]}
            onPress={() => ejecutar("detener")}
            disabled={enviando !== null || sinAlarma}
          >
            {enviando === "detener" ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="stop-circle" size={30} color={COLORS.text} />
                <View style={styles.actionTexts}>
                  <Text style={styles.actionTitle}>DETENER</Text>
                  <Text style={styles.actionSub}>
                    Apaga buzzer, LED y relay
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>CÓMO FUNCIONA</Text>
            <Text style={styles.infoText}>
              1. La app guarda el evento en Supabase.{"\n"}
              2. El ESP32 lo lee por WiFi y activa el hardware.{"\n"}
              3. Detener cambia el estado del evento y el ESP32 lo aplica en su
              próxima consulta.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  back: { padding: 4 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "bold" },
  center: { paddingVertical: 60, alignItems: "center" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 20,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: "bold" },
  cardText: { color: COLORS.textMuted, fontSize: 13, marginTop: 6 },
  cardHint: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 12,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  actionTexts: { marginLeft: 15 },
  actionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  actionSub: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
  disabled: { opacity: 0.45 },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginTop: 10,
  },
  infoTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 21 },
});
