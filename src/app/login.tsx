import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import {
  guardarUltimoEmail,
  obtenerUltimoEmail,
} from "../services/almacenamiento";
import { iniciarSesion } from "../services/auth";
import { supabase } from "../services/supabase";
import { COLORS } from "../theme/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const passwordRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    obtenerUltimoEmail()
      .then((savedEmail) => {
        if (savedEmail) setEmail(savedEmail);
      })
      .catch(() => {
        // Si el almacenamiento falla, el usuario escribe el correo igual.
      });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const esEmailValido = email.includes("@") && email.includes(".");

  const handleLogin = async () => {
    setErrorMsg("");
    if (!email || !password) {
      setErrorMsg("Completá todos los campos");
      Vibration.vibrate(200);
      return;
    }

    setLoading(true);
    console.log("1. Intentando iniciar sesión con:", email);

    try {
      const user = await iniciarSesion(email, password);
      console.log("2. ✅ Login Auth exitoso. ID:", user?.id);
      await guardarUltimoEmail(email).catch(() => {
        // No bloqueamos el login si no se puede recordar el correo.
      });

      // 🔍 BUSCAMOS EL PERFIL EN LA TABLA
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      // 🚀 TRUCO DEFINITIVO: Si el email es el de la empresa, forzamos superadmin
      const esEmailAdmin =
        email.toLowerCase() === "adminvision360@vision360.com";

      if (esEmailAdmin || perfil?.rol === "superadmin") {
        console.log("🚀 REDIRIGIENDO A SUPERADMIN DASHBOARD");
        router.replace("/(superadmin)/dashboard");
      } else if (perfil?.id_barrio) {
        // 👇 CORRECCIÓN: Si es vecino Y tiene barrio, va a las alarmas
        console.log("🏠 Redirigiendo a MI BARRIO (Vecino con barrio)");
        router.replace("/(tabs)/mi-barrio");
      } else {
        // 👇 CORRECCIÓN: Si es vecino SIN barrio, va a la pantalla de código
        console.log("⚠️ Redirigiendo a SELECCIÓN DE BARRIO (Sin barrio)");
        router.replace("/seleccion-barrio");
      }
    } catch (error: any) {
      console.error("❌ ERROR CRÍTICO:", error);
      setErrorMsg(error.message || "Ocurrió un error al iniciar sesión");
      Vibration.vibrate(400);
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons name="eye" size={32} color={COLORS.primary} />
            <Text style={styles.logoText}>VISION360</Text>
          </View>

          <Animated.View
            style={[
              styles.card,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.avatarCircle}>
              <Ionicons
                name="person-outline"
                size={70}
                color={COLORS.textMuted}
              />
            </View>

            <View
              style={[
                styles.inputWrapper,
                email.length > 0 &&
                  !esEmailValido && { borderColor: COLORS.danger },
              ]}
            >
              <Text style={styles.inputLabel}>Correo:</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMsg("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Contraseña:</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrorMsg("");
                }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              onPress={() => router.push("/recuperar-password")}
              style={styles.forgotWrapper}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || !email || !password) && { opacity: 0.5 },
              ]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>INGRESAR</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>O</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/registro")}
              style={styles.registerButton}
            >
              <Text style={styles.registerText}>Crear una cuenta nueva</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 8, 18, 0.75)",
  },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  logoText: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 4,
    marginLeft: 10,
  },
  card: {
    backgroundColor: "rgba(19, 24, 37, 0.95)",
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },
  inputWrapper: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginRight: 10,
    fontWeight: "600",
  },
  input: { flex: 1, color: COLORS.text, fontSize: 15, height: "100%" },
  eyeIcon: { padding: 5 },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    alignSelf: "flex-start",
    marginBottom: 10,
    marginLeft: 5,
  },
  forgotWrapper: { alignSelf: "flex-end", marginBottom: 20 },
  forgotText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.textMuted, marginHorizontal: 10, fontSize: 12 },
  registerButton: {
    width: "100%",
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  registerText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
});
