import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { borrarUltimoEmail } from "../../services/almacenamiento";
import { supabase } from "../../services/supabase";
import { COLORS } from "../../theme/colors";

export default function PerfilScreen() {
  const [user, setUser] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [barrio, setBarrio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data } = await supabase
            .from("perfiles")
            .select("*, barrios(nombre, codigo_invitacion)")
            .eq("id", user.id)
            .single();

          setPerfil(data);
          if (data?.barrios) setBarrio(data.barrios);
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  // Función para forzar el cierre de sesión y limpiar el celular
  const forzarCierreSesion = async () => {
    try {
      await supabase.auth.signOut();
      await borrarUltimoEmail(); // Borra el email guardado
      router.replace("/login");
    } catch (error) {
      // Si falla Supabase, igual limpiamos y mandamos al login
      router.replace("/login");
    }
  };

  const handleCerrarSesion = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro que querés salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: forzarCierreSesion },
    ]);
  };

  const handleEliminarCuenta = () => {
    Alert.alert(
      "⚠️ Eliminar Cuenta",
      "Esta acción borrará tu perfil y te sacará de la app. ¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, eliminar",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // 1. Borrar el perfil de la base de datos
              if (user?.id) {
                await supabase.from("perfiles").delete().eq("id", user.id);
              }

              // 2. Cerrar sesión y limpiar el celular
              await supabase.auth.signOut();
              await borrarUltimoEmail();

              Alert.alert(
                "Cuenta eliminada",
                "Tu cuenta ha sido eliminada correctamente.",
              );
              router.replace("/login");
            } catch (error: any) {
              Alert.alert(
                "Error",
                "No se pudo eliminar la cuenta, pero cerraremos tu sesión.",
              );
              await forzarCierreSesion();
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const nombre = user?.user_metadata?.nombre_completo || "Usuario";
  const inicial = nombre.charAt(0).toUpperCase();
  const esAdmin = perfil?.rol === "admin";

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{inicial}</Text>
        </View>
        <Text style={styles.name}>{nombre}</Text>
        <Text style={styles.email}>{user?.email || "Sin correo"}</Text>

        <View
          style={[
            styles.rolBadge,
            { backgroundColor: esAdmin ? COLORS.primary : COLORS.success },
          ]}
        >
          <Text style={styles.rolText}>
            {perfil?.rol?.toUpperCase() || "VECINO"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MI BARRIO</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.barrioName}>
              {barrio?.nombre || "Sin Barrio"}
            </Text>
            <Ionicons name="home" size={24} color={COLORS.primary} />
          </View>

          {barrio && (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Código de invitación:</Text>
              <Text style={styles.codeText}>{barrio.codigo_invitacion}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OPCIONES DE CUENTA</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.replace("/seleccion-barrio")}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={22}
            color={COLORS.text}
          />
          <Text style={styles.menuText}>Cambiar de Barrio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleCerrarSesion}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.warning} />
          <Text style={[styles.menuText, { color: COLORS.warning }]}>
            Cerrar Sesión
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleEliminarCuenta}
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
          <Text style={[styles.menuText, { color: COLORS.danger }]}>
            Eliminar Cuenta
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Vision360 v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  profileHeader: { alignItems: "center", paddingTop: 60, paddingBottom: 30 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarText: { color: COLORS.text, fontSize: 40, fontWeight: "bold" },
  name: { color: COLORS.text, fontSize: 22, fontWeight: "bold", marginTop: 15 },
  email: { color: COLORS.textMuted, fontSize: 14, marginTop: 5 },
  rolBadge: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    marginTop: 10,
  },
  rolText: { color: COLORS.text, fontSize: 11, fontWeight: "bold" },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
  },

  card: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  barrioName: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    padding: 15,
    borderRadius: 10,
    justifyContent: "space-between",
  },
  codeLabel: { color: COLORS.textMuted, fontSize: 12 },
  codeText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuText: { flex: 1, color: COLORS.text, fontSize: 15, marginLeft: 15 },

  version: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginVertical: 30,
    fontSize: 11,
  },
});
