import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { cerrarSesion } from "../../services/auth";
import { crearEvento } from "../../services/eventos";
import {
  AlarmaActual,
  ComandoHardware,
  enviarComandoHardware,
  obtenerAlarmaActual,
} from "../../services/hardware";
import { supabase } from "../../services/supabase";
import { COLORS } from "../../theme/colors";

const { width } = Dimensions.get("window");

export default function MiBarrioScreen() {
  const [user, setUser] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [barrio, setBarrio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [enviando, setEnviando] = useState(false);
  const [alarmaActual, setAlarmaActual] = useState<AlarmaActual | null>(null);
  const [enviandoComando, setEnviandoComando] = useState<ComandoHardware | null>(
    null,
  );

  // Estado para el contador del botón de pánico
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tipoAlarmaPendiente, setTipoAlarmaPendiente] = useState<
    "panico" | "incendio" | "emergencia" | null
  >(null);

  // Animación del menú lateral
  const menuAnim = useRef(new Animated.Value(1)).current;
  const [menuOpen, setMenuOpen] = useState(true);

  // Configuración inicial de notificaciones y carga de datos
  useEffect(() => {
    const configurarNotificaciones = async () => {
      try {
        // 👇 Importación dinámica para evitar que Expo Go explote al abrir la app
        const Notifications = await import("expo-notifications");

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("alarmas", {
            name: "Alarmas Vecinales",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF0000",
          });
        }
      } catch (error) {
        console.log(
          "Notificaciones no disponibles en este entorno (Expo Go)",
          error,
        );
      }
    };

    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        // Cargar datos del barrio y del perfil
        const { data: perfilData } = await supabase
          .from("perfiles")
          .select("*, barrios(nombre)")
          .eq("id", user?.id)
          .single();
        setPerfil(perfilData);
        if (perfilData?.barrios) setBarrio(perfilData.barrios);
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    configurarNotificaciones();
    fetchData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cualquier celular del barrio ve la alarma en curso y puede detenerla,
  // no solo el que la disparó. Se consulta cada 5 s (el ESP32 hace lo mismo).
  useEffect(() => {
    const idBarrio = perfil?.id_barrio;
    if (!idBarrio) return;

    let activo = true;

    const consultarAlarma = async () => {
      try {
        const data = await obtenerAlarmaActual(idBarrio);
        if (activo) setAlarmaActual(data);
      } catch (error) {
        console.log("No se pudo leer la alarma:", error);
      }
    };

    consultarAlarma();
    const timer = setInterval(consultarAlarma, 5000);

    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, [perfil?.id_barrio]);

  // Animación del menú
  const toggleMenu = () => {
    Animated.timing(menuAnim, {
      toValue: menuOpen ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setMenuOpen(!menuOpen);
  };

  // Función que se dispara al tocar un botón
  const iniciarAlarma = (tipo: "panico" | "incendio" | "emergencia") => {
    setTipoAlarmaPendiente(tipo);
    // El botón de pánico tiene cuenta regresiva para evitar toques accidentales
    if (tipo === "panico") {
      setCountdown(3);
      Vibration.vibrate(200);
    } else {
      // Incendio y emergencia se envían directo
      enviarAlerta(tipo);
    }
  };

  // Lógica de la cuenta regresiva del pánico
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      if (tipoAlarmaPendiente) enviarAlerta(tipoAlarmaPendiente);
      setCountdown(null);
      setTipoAlarmaPendiente(null);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, tipoAlarmaPendiente]);

  // Función real que guarda en base de datos y lanza la notificación
  const enviarAlerta = async (tipo: "panico" | "incendio" | "emergencia") => {
    setEnviando(true);
    if (tipo === "panico") Vibration.vibrate([500, 200, 500, 200, 500]);

    try {
      // 1. Guardar en la base de datos (Esto siempre va a funcionar)
      const creado = await crearEvento({
        tipo,
        descripcion: `ALERTA DE ${tipo.toUpperCase()} activada por ${user?.user_metadata?.nombre_completo || "Vecino"}`,
        fecha_hora: new Date().toISOString(),
        lugar: barrio?.nombre || "Barrio Desconocido",
        usuario: user?.user_metadata?.nombre_completo || "Vecino",
        nivel: tipo === "panico" ? "alto" : "medio",
        id_barrio: perfil?.id_barrio || undefined,
      });

      // El ESP32 va a leer este evento en su próxima consulta.
      if (creado?.id_evento) {
        setAlarmaActual({
          id_evento: creado.id_evento,
          tipo: creado.tipo,
          estado_alarma: creado.estado_alarma || "activa",
          fecha_hora: creado.fecha_hora,
        });
      }

      // 2. Intentar enviar la notificación local (Importación dinámica)
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              tipo === "panico"
                ? "🚨 ¡ALERTA DE PÁNICO!"
                : `⚠️ ALERTA DE ${tipo.toUpperCase()}`,
            body: `Emergencia reportada en ${barrio?.nombre || "tu barrio"}.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate:
              tipo === "panico" ? [0, 500, 200, 500, 200, 500] : [0, 250],
          },
          trigger: null,
        });
      } catch (notifError) {
        console.log("No se pudo mostrar la notificación local:", notifError);
      }

      Alert.alert(
        "✅ Alerta Enviada",
        "Los vecinos de tu barrio han sido notificados.",
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message || "No se pudo enviar la alerta a la base de datos.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const cancelarPanico = () => {
    setCountdown(null);
    setTipoAlarmaPendiente(null);
    Alert.alert("Cancelado", "La alerta de pánico fue cancelada.");
  };

  // Manda una orden al ESP32 (silenciar el buzzer o detener todo).
  // No crea comandos: cambia evento.estado_alarma.
  const controlarHardware = async (comando: ComandoHardware) => {
    if (!alarmaActual?.id_evento) return;

    setEnviandoComando(comando);
    try {
      await enviarComandoHardware(alarmaActual.id_evento, comando);
      setAlarmaActual({
        ...alarmaActual,
        estado_alarma: comando === "detener" ? "detenida" : "silenciada",
      });
      Alert.alert(
        comando === "detener" ? "⏹ Alarma detenida" : "🔇 Buzzer silenciado",
        "El ESP32 va a ejecutar la orden en unos segundos.",
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar la orden al ESP32",
      );
    } finally {
      setEnviandoComando(null);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  const nombreMostrar =
    user?.user_metadata?.nombre_completo?.split(" ")[0] || "Vecino";
  const inicial = nombreMostrar.charAt(0).toUpperCase();
  const menuWidth = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.45],
  });

  return (
    <View style={styles.container}>
      {/* Menú lateral animado */}
      <Animated.View style={[styles.sidebar, { width: menuWidth }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 15 }}
        >
          <View style={styles.userInfo}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{inicial}</Text>
            </View>
            <Text style={styles.userLabel} numberOfLines={1}>
              {nombreMostrar}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {barrio?.nombre || "Sin Barrio"}
            </Text>
          </View>

          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/(tabs)/mi-vivienda")}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color={COLORS.text}
              />
              <Text style={styles.menuText}>Historial de Eventos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/(tabs)/alertas")}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={COLORS.text}
              />
              <Text style={styles.menuText}>Alertas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/camara/live" as any)}
            >
              <Ionicons
                name="videocam-outline"
                size={22}
                color={COLORS.text}
              />
              <Text style={styles.menuText}>Cámara en vivo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/control-dispositivo" as any)}
            >
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={COLORS.text}
              />
              <Text style={styles.menuText}>Alarma</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/(tabs)/chat")}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={22}
                color={COLORS.text}
              />
              <Text style={styles.menuText}>Chat Vecinal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/(tabs)/perfil")}
            >
              <Ionicons name="person-outline" size={22} color={COLORS.text} />
              <Text style={styles.menuText}>Mi Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                cerrarSesion();
                router.replace("/login");
              }}
            >
              <Ionicons name="log-out-outline" size={22} color={COLORS.text} />
              <Text style={styles.menuText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Contenido Principal con la foto de fondo */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
        }}
        style={styles.mainContent}
      >
        <View style={styles.mainOverlay}>
          {/* Header con botón de menú */}
          <View style={styles.header}>
            <TouchableOpacity onPress={toggleMenu} style={styles.iconButton}>
              <Ionicons
                name={menuOpen ? "close" : "menu"}
                size={28}
                color={COLORS.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/camara/live" as any)}
              style={styles.iconButton}
            >
              <Ionicons name="videocam-outline" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Bienvenida */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Hola, {nombreMostrar}</Text>
            <Text style={styles.welcomeSubtitle}>
              {currentTime.toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
          </View>

          {/* ÁREA DE LOS 3 BOTONES DE EMERGENCIA */}
          <View style={styles.alarmsContainer}>
            {alarmaActual && alarmaActual.estado_alarma !== "detenida" && (
              <View style={styles.hardwarePanel}>
                <View style={styles.hardwareHeader}>
                  <Ionicons
                    name="hardware-chip"
                    size={18}
                    color={COLORS.warning}
                  />
                  <Text style={styles.hardwareTitle}>CONTROL DE ALARMA</Text>
                </View>
                <Text style={styles.hardwareHint}>
                  {alarmaActual.estado_alarma === "silenciada"
                    ? "Buzzer silenciado. Las luces y el relay siguen activos."
                    : "El ESP32 la recibe en unos segundos por WiFi."}
                </Text>
                <View style={styles.rowButtons}>
                  <TouchableOpacity
                    style={[
                      styles.hardwareButton,
                      styles.hardwareButtonFull,
                      { backgroundColor: COLORS.primaryDark },
                      enviandoComando !== null && { opacity: 0.5 },
                    ]}
                    onPress={() => controlarHardware("detener")}
                    disabled={enviandoComando !== null}
                  >
                    <Ionicons
                      name="stop-circle"
                      size={20}
                      color={COLORS.text}
                    />
                    <Text style={styles.hardwareButtonText}>DETENER</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>BOTONES DE EMERGENCIA</Text>

            {/* 1. PÁNICO (Rojo) */}
            {countdown !== null ? (
              <View style={styles.countdownBox}>
                <Text style={styles.countdownText}>{countdown}</Text>
                <Text style={styles.countdownLabel}>Enviando alerta...</Text>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelarPanico}
                >
                  <Text style={styles.cancelButtonText}>CANCELAR</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.alarmButton, { backgroundColor: "#b71c1c" }]}
                onPress={() => iniciarAlarma("panico")}
                disabled={enviando}
              >
                <Ionicons name="alert-circle" size={45} color={COLORS.text} />
                <Text style={styles.alarmText}>PÁNICO</Text>
                <Text style={styles.alarmSub}>Asalto o intruso</Text>
              </TouchableOpacity>
            )}

            <View style={styles.rowButtons}>
              {/* 2. INCENDIO (Naranja) */}
              <TouchableOpacity
                style={[styles.alarmButtonHalf, { backgroundColor: "#e65100" }]}
                onPress={() => iniciarAlarma("incendio")}
                disabled={enviando}
              >
                <Ionicons name="flame" size={32} color={COLORS.text} />
                <Text style={styles.alarmTextHalf}>INCENDIO</Text>
                <Text style={styles.alarmSubHalf}>Humo o fuego</Text>
              </TouchableOpacity>

              {/* 3. EMERGENCIA MÉDICA (Verde/Azul) */}
              <TouchableOpacity
                style={[styles.alarmButtonHalf, { backgroundColor: "#00796b" }]}
                onPress={() => iniciarAlarma("emergencia")}
                disabled={enviando}
              >
                <Ionicons name="medkit" size={32} color={COLORS.text} />
                <Text style={styles.alarmTextHalf}>MÉDICA</Text>
                <Text style={styles.alarmSubHalf}>Salud / Accidente</Text>
              </TouchableOpacity>
            </View>

            {enviando && (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginTop: 20 }}
              />
            )}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  // Estilos del menú lateral
  sidebar: {
    backgroundColor: COLORS.primaryDark,
    overflow: "hidden",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.1)",
  },
  userInfo: { alignItems: "center", marginBottom: 30 },
  avatarCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  avatarText: { color: COLORS.text, fontSize: 30, fontWeight: "bold" },
  userLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  userEmail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  menu: { marginTop: 10 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 8,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 12,
  },

  // Estilos de la pantalla principal
  mainContent: { flex: 1 },
  mainOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 18, 0.65)",
    padding: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
  },
  iconButton: { padding: 5 },

  welcomeSection: { marginTop: 25 },
  welcomeTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  welcomeSubtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 5 },

  // Estilos de los botones de alarma
  alarmsContainer: { flex: 1, justifyContent: "flex-end", paddingBottom: 30 },
  hardwarePanel: {
    backgroundColor: "rgba(19, 24, 37, 0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.warning,
    padding: 12,
    marginBottom: 15,
  },
  hardwareHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  hardwareTitle: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    marginLeft: 6,
  },
  hardwareHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginBottom: 10,
  },
  hardwareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "48%",
    paddingVertical: 12,
    borderRadius: 10,
  },
  hardwareButtonFull: { width: "100%" },
  hardwareButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 15,
    textAlign: "center",
  },

  alarmButton: {
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    height: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  alarmText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: 1,
  },
  alarmSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },

  rowButtons: { flexDirection: "row", justifyContent: "space-between" },
  alarmButtonHalf: {
    width: "48%",
    padding: 15,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  alarmTextHalf: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: 1,
  },
  alarmSubHalf: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },

  // Estilos de la cuenta regresiva
  countdownBox: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    height: 140,
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  countdownText: { color: COLORS.text, fontSize: 50, fontWeight: "bold" },
  countdownLabel: { color: COLORS.text, fontSize: 14, marginTop: -5 },
  cancelButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 20,
    backgroundColor: COLORS.text,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: COLORS.primaryDark,
    fontWeight: "bold",
    fontSize: 12,
  },
});
