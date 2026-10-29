import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { crearEvento } from "../services/eventos";
import { supabase } from "../services/supabase";
import { COLORS } from "../theme/colors";

export default function CrearEventoScreen() {
  const [tipo, setTipo] = useState<"manual" | "movimiento" | "panico">(
    "manual",
  );
  const [nivel, setNivel] = useState<"bajo" | "medio" | "alto">("medio");
  const [lugar, setLugar] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const seleccionarFoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled) setFoto(result.assets[0].uri);
  };

  const handleGuardar = async () => {
    if (!lugar || !descripcion)
      return Alert.alert("Error", "Completá el lugar y la descripción");

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nombreUsuario = user?.user_metadata?.nombre_completo || "Vecino";

      await crearEvento({
        tipo,
        descripcion,
        fecha_hora: new Date().toISOString(),
        lugar,
        usuario: nombreUsuario,
        nivel,
        captura_url: foto || undefined,
      });

      Alert.alert(
        "✅ Evento Creado",
        "El evento se guardó correctamente en el historial.",
      );
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo crear el evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nuevo Evento</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.label}>Tipo de evento</Text>
      <View style={styles.row}>
        {["manual", "movimiento", "panico"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, tipo === t && styles.chipActive]}
            onPress={() => setTipo(t as any)}
          >
            <Text
              style={[styles.chipText, tipo === t && styles.chipTextActive]}
            >
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Nivel de gravedad</Text>
      <View style={styles.row}>
        {["bajo", "medio", "alto"].map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.chip,
              nivel === n && {
                backgroundColor: n === "alto" ? COLORS.primary : COLORS.warning,
              },
            ]}
            onPress={() => setNivel(n as any)}
          >
            <Text
              style={[styles.chipText, nivel === n && styles.chipTextActive]}
            >
              {n.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Lugar</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Barrio Uriburu / Casa 4"
        placeholderTextColor={COLORS.textMuted}
        value={lugar}
        onChangeText={setLugar}
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="¿Qué sucedió?"
        placeholderTextColor={COLORS.textMuted}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
      />

      <Text style={styles.label}>Foto (opcional)</Text>
      <TouchableOpacity style={styles.photoBtn} onPress={seleccionarFoto}>
        {foto ? (
          <Image source={{ uri: foto }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={30} color={COLORS.textMuted} />
            <Text style={styles.photoText}>Adjuntar foto</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveBtn, loading && { opacity: 0.6 }]}
        onPress={handleGuardar}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={styles.saveBtnText}>GUARDAR EVENTO</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "bold" },
  label: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 10 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "bold" },
  chipTextActive: { color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  photoBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  photoPlaceholder: { alignItems: "center" },
  photoText: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  photoPreview: { width: "100%", height: "100%" },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: 40,
  },
  saveBtnText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
});
