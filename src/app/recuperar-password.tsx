import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { recuperarPassword } from "../services/auth";
import { COLORS } from "../theme/colors";

export default function RecuperarPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => setCountdown((valor) => valor - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRecuperar = async () => {
    if (!email.includes("@"))
      return Alert.alert("Error", "Ingresá un correo válido");

    setLoading(true);
    try {
      await recuperarPassword(email);
      Vibration.vibrate(200);
      setEnviado(true);
      setCountdown(60);
    } catch (error: any) {
      Alert.alert(
        "Error",
        "No se pudo enviar el correo. Verificá que esté registrado.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.card}>
        {enviado ? (
          // Vista de Éxito
          <View style={styles.successContainer}>
            <Ionicons
              name="checkmark-circle"
              size={80}
              color={COLORS.success}
            />
            <Text style={styles.title}>¡Correo Enviado!</Text>
            <Text style={styles.subtitle}>
              Revisá tu bandeja de entrada en {email} y seguí las instrucciones
              para restablecer tu contraseña.
            </Text>

            <TouchableOpacity
              style={[styles.button, countdown > 0 && { opacity: 0.5 }]}
              onPress={handleRecuperar}
              disabled={countdown > 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.buttonText}>
                  {countdown > 0
                    ? `Reenviar en ${countdown}s`
                    : "Reenviar correo"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Vista de Formulario
          <View>
            <Ionicons
              name="key-outline"
              size={60}
              color={COLORS.primary}
              style={{ alignSelf: "center", marginBottom: 20 }}
            />
            <Text style={styles.title}>Recuperar Contraseña</Text>
            <Text style={styles.subtitle}>
              Ingresá tu correo electrónico y te enviaremos un enlace seguro
              para restablecer tu clave.
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRecuperar}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.buttonText}>ENVIAR ENLACE</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 20,
  },
  backButton: { position: "absolute", top: 50, left: 20, zIndex: 10 },
  card: {
    backgroundColor: COLORS.surface,
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 55,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: COLORS.text, fontSize: 15, height: "100%" },
  button: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 1,
  },
  successContainer: { alignItems: "center" },
  linkButton: { marginTop: 20 },
  linkText: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
});
