import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View
} from "react-native";
import { supabase } from "../../services/supabase";
import { COLORS } from "../../theme/colors";

export default function AlertasScreen() {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<any>(null);

  useEffect(() => {
    const cargar = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: perfilData } = await supabase
          .from("perfiles")
          .select("id_barrio")
          .eq("id", user.id)
          .single();
        setPerfil(perfilData);

        if (perfilData?.id_barrio) {
          const { data } = await supabase
            .from("evento")
            .select("*")
            .eq("id_barrio", perfilData.id_barrio) // 👈 Filtramos por barrio
            .order("fecha_hora", { ascending: false });
          if (data) setAlertas(data);
        }
      }
      setLoading(false);
    };
    cargar();
  }, []);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  if (!perfil?.id_barrio) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-outline" size={80} color={COLORS.textMuted} />
        <Text style={styles.blockTitle}>Sin Barrio</Text>
        <Text style={styles.blockSub}>
          Unite a un barrio para ver las alertas de seguridad.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alertas del Barrio</Text>
        <Text style={styles.headerSub}>{alertas.length} eventos</Text>
      </View>

      <FlatList
        data={alertas}
        keyExtractor={(item) => item.id_evento.toString()}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => {
          const esPanico = item.tipo === "panico";
          return (
            <View style={[styles.alertCard, esPanico && styles.alertCardPanic]}>
              <View style={styles.alertHeader}>
                <Ionicons
                  name={esPanico ? "alert-circle" : "warning"}
                  size={24}
                  color={esPanico ? COLORS.primary : COLORS.warning}
                />
                <Text style={styles.alertTitle}>{item.tipo.toUpperCase()}</Text>
                <Text style={styles.alertDate}>
                  {new Date(item.fecha_hora).toLocaleString("es-AR")}
                </Text>
              </View>
              <Text style={styles.alertDesc}>{item.descripcion}</Text>
              <Text style={styles.alertUser}>
                Reportado por: {item.usuario}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text
            style={{
              color: COLORS.textMuted,
              textAlign: "center",
              marginTop: 50,
            }}
          >
            Todo tranquilo por acá.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 30,
  },
  blockTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 20,
  },
  blockSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: "bold" },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertCardPanic: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(211, 47, 47, 0.1)",
  },
  alertHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  alertTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
    flex: 1,
  },
  alertDate: { color: COLORS.textMuted, fontSize: 10 },
  alertDesc: { color: COLORS.text, fontSize: 13, marginBottom: 8 },
  alertUser: { color: COLORS.textMuted, fontSize: 11, fontStyle: "italic" },
});
