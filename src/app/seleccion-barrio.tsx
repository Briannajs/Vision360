import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { cerrarSesion } from "../services/auth";
import { supabase } from "../services/supabase";
import { COLORS } from "../theme/colors";

export default function SeleccionBarrioScreen() {
  const [codigo, setCodigo] = useState("");
  const [nombreBarrio, setNombreBarrio] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();
        if (data?.rol === "admin") setEsAdmin(true);
      }
    };
    checkUser();
  }, []);

  const unirseBarrio = async () => {
    if (!codigo) return Alert.alert("Error", "Ingresá un código");
    setLoading(true);
    try {
      const { data: barrio, error } = await supabase
        .from("barrios")
        .select("id_barrio")
        .eq("codigo_invitacion", codigo.toUpperCase())
        .single();

      if (error || !barrio)
        throw new Error("Código inválido o barrio no encontrado");

      const { error: perfilError } = await supabase.from("perfiles").upsert({
        id: user.id,
        nombre_completo: user.user_metadata?.nombre_completo || "Vecino",
        rol: "vecino",
        id_barrio: barrio.id_barrio,
      });

      if (perfilError) throw perfilError;

      router.replace("/(tabs)/mi-barrio");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const crearBarrio = async () => {
    if (!nombreBarrio)
      return Alert.alert("Error", "Ponele un nombre al barrio");
    setLoading(true);
    try {
      const nuevoCodigo = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const { data, error } = await supabase
        .from("barrios")
        .insert([
          {
            nombre: nombreBarrio,
            codigo_invitacion: nuevoCodigo,
            id_admin: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await supabase.from("perfiles").upsert({
        id: user.id,
        nombre_completo: user.user_metadata?.nombre_completo || "Admin",
        rol: "admin",
        id_barrio: data.id_barrio,
      });

      Alert.alert(
        "✅ Barrio Creado",
        `Tu código es: ${nuevoCodigo}\nCompartilo con tus vecinos.`,
      );
      router.replace("/(tabs)/mi-barrio");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
      }}
      style={styles.background}
    >
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Ionicons
          name="home"
          size={60}
          color={COLORS.primary}
          style={{ alignSelf: "center", marginBottom: 20 }}
        />
        <Text style={styles.title}>Bienvenido a Vision360</Text>
        <Text style={styles.subtitle}>
          Para usar las alarmas y el chat, primero unite a tu barrio.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>¿Tenés un código de invitación?</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: AB12CD"
            placeholderTextColor={COLORS.textMuted}
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={unirseBarrio}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>UNIRSE AL BARRIO</Text>
            )}
          </TouchableOpacity>
        </View>

        {esAdmin && (
          <View style={[styles.card, { borderColor: COLORS.warning }]}>
            <Text style={[styles.cardTitle, { color: COLORS.warning }]}>
              Sos Admin: Crear Barrio Nuevo
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del barrio"
              placeholderTextColor={COLORS.textMuted}
              value={nombreBarrio}
              onChangeText={setNombreBarrio}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.warning }]}
              onPress={crearBarrio}
              disabled={loading}
            >
              <Text style={styles.buttonText}>CREAR Y GENERAR CÓDIGO</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await cerrarSesion();
            router.replace("/login");
          }}
        >
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 8, 18, 0.85)",
  },
  container: { flex: 1, justifyContent: "center", padding: 25 },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 30,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.text,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: "center",
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: COLORS.text, fontWeight: "bold", fontSize: 15 },
  logoutBtn: { marginTop: 20, alignItems: "center" },
  logoutText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
