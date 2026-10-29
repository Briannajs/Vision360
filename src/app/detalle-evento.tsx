import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Evento, obtenerEventoPorId } from "../services/eventos";
import { COLORS } from "../theme/colors";

export default function DetalleEventoScreen() {
  const { id } = useLocalSearchParams();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (id) cargarEvento();
  }, [id]);

  const cargarEvento = async () => {
    try {
      const data = await obtenerEventoPorId(id as string);
      setEvento(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const compartirEvento = () => {
    if (!evento) return;
    Share.share({
      message: `🚨 EVENTO VISION360\nTipo: ${evento.tipo.toUpperCase()}\nLugar: ${evento.lugar}\nFecha: ${new Date(evento.fecha_hora).toLocaleString("es-AR")}\nDesc: ${evento.descripcion}`,
    });
  };

  const copiarDireccion = async () => {
    if (evento?.lugar) {
      await Clipboard.setStringAsync(evento.lugar);
      Alert.alert("✅ Copiado", "La dirección se copió al portapapeles.");
    }
  };

  const llamar911 = () => Linking.openURL("tel:911");

  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  if (!evento)
    return (
      <View style={styles.loading}>
        <Text style={{ color: COLORS.text }}>Evento no encontrado</Text>
      </View>
    );

  const fechaObj = new Date(evento.fecha_hora);
  const esPanico = evento.tipo === "panico";
  const nivelColor =
    evento.nivel === "alto"
      ? COLORS.primary
      : evento.nivel === "medio"
        ? COLORS.warning
        : COLORS.success;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle</Text>
        <TouchableOpacity onPress={compartirEvento}>
          <Ionicons name="share-social" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Alerta visual si es pánico */}
      {esPanico && (
        <TouchableOpacity style={styles.sosBanner} onPress={llamar911}>
          <Ionicons name="call" size={24} color={COLORS.text} />
          <Text style={styles.sosText}>EMERGENCIA: LLAMAR AL 911</Text>
        </TouchableOpacity>
      )}

      <View style={styles.infoCard}>
        <View style={styles.rowBetween}>
          <View style={[styles.nivelBadge, { backgroundColor: nivelColor }]}>
            <Text style={styles.nivelText}>
              NIVEL {evento.nivel?.toUpperCase() || "MEDIO"}
            </Text>
          </View>
          <Text style={styles.fechaText}>
            {fechaObj.toLocaleDateString("es-AR")} •{" "}
            {fechaObj.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>{evento.lugar || "Sin lugar"}</Text>
          <TouchableOpacity onPress={copiarDireccion}>
            <Ionicons name="copy" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="person" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>Reportado por: {evento.usuario}</Text>
        </View>
      </View>

      <View style={styles.descCard}>
        <Text style={styles.sectionTitle}>DESCRIPCIÓN</Text>
        <Text style={styles.descText}>{evento.descripcion}</Text>
      </View>

      {evento.captura_url && (
        <View style={styles.captureCard}>
          <Text style={styles.sectionTitle}>EVIDENCIA FOTOGRÁFICA</Text>
          <TouchableOpacity onPress={() => setZoom(!zoom)}>
            <Image
              source={{ uri: evento.captura_url }}
              style={[styles.captureImage, zoom && { height: 400 }]}
              resizeMode={zoom ? "contain" : "cover"}
            />
            <View style={styles.zoomBadge}>
              <Ionicons
                name={zoom ? "contract" : "expand"}
                size={16}
                color={COLORS.text}
              />
              <Text style={styles.zoomText}>
                {zoom ? "Reducir" : "Ampliar"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() =>
          Alert.alert("Reportar", "¿Reportar este evento como falso?")
        }
      >
        <Ionicons name="flag" size={18} color={COLORS.textMuted} />
        <Text style={styles.reportText}>Reportar evento como falso</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.volverButton}
        onPress={() => router.back()}
      >
        <Text style={styles.volverText}>Volver al historial</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
  sosBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  sosText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  nivelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  nivelText: { color: COLORS.text, fontSize: 10, fontWeight: "bold" },
  fechaText: { color: COLORS.textMuted, fontSize: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  infoText: { color: COLORS.text, fontSize: 14, marginLeft: 10, flex: 1 },
  descCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
  },
  descText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  captureCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  captureImage: { width: "100%", height: 220, borderRadius: 10, marginTop: 5 },
  zoomBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  zoomText: { color: COLORS.text, fontSize: 10, marginLeft: 5 },
  reportButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  reportText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 5,
    textDecorationLine: "underline",
  },
  volverButton: {
    backgroundColor: COLORS.primaryDark,
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  volverText: { color: COLORS.text, fontWeight: "bold", fontSize: 15 },
});
