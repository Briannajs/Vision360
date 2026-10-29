import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { CorreoYaRegistradoError, registrarUsuario } from "../services/auth";
import { COLORS } from "../theme/colors";

export default function RegistroScreen() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const apellidoRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Calcular fuerza de contraseña
  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length > 5) strength += 1;
    if (password.length > 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    return strength;
  };
  const strength = getPasswordStrength();
  const strengthColor =
    strength <= 1
      ? COLORS.danger
      : strength <= 2
        ? COLORS.warning
        : COLORS.success;
  const strengthText =
    strength <= 1 ? "Débil" : strength <= 2 ? "Media" : "Fuerte";

  const handleRegistro = async () => {
    if (!nombre || !apellido || !email || !password || !confirmPassword)
      return Alert.alert("Error", "Completá todos los campos");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return Alert.alert("Error", "Ingresá un correo electrónico válido");
    if (password !== confirmPassword)
      return Alert.alert("Error", "Las contraseñas no coinciden");
    if (!aceptaTerminos)
      return Alert.alert("Error", "Debés aceptar los términos y condiciones");
    if (password.length < 6)
      return Alert.alert(
        "Error",
        "La contraseña debe tener al menos 6 caracteres",
      );

    setLoading(true);
    try {
      await registrarUsuario(email, password, `${nombre} ${apellido}`);
      Vibration.vibrate(200); // Vibración de éxito
      Alert.alert(
        "✅ Cuenta Creada",
        "Revisá tu correo para confirmar (o iniciá sesión directo).",
      );
      router.replace("/login");
    } catch (error: any) {
      if (error instanceof CorreoYaRegistradoError) {
        Alert.alert("Correo ya registrado", error.message, [
          {
            text: "Iniciar sesión",
            onPress: () => router.replace("/login"),
          },
          { text: "Cancelar", style: "cancel" },
        ]);
        return;
      }
      Alert.alert("Error", error.message || "Ocurrió un error");
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>
            Unite a la red de seguridad de tu barrio
          </Text>

          <View style={styles.card}>
            {/* Nombre */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="Nombre"
                placeholderTextColor={COLORS.textMuted}
                value={nombre}
                onChangeText={setNombre}
                returnKeyType="next"
                onSubmitEditing={() => apellidoRef.current?.focus()}
              />
            </View>

            {/* Apellido */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                ref={apellidoRef}
                style={styles.input}
                placeholder="Apellido"
                placeholderTextColor={COLORS.textMuted}
                value={apellido}
                onChangeText={setApellido}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
            </View>

            {/* Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                ref={passRef}
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Barra de fuerza de contraseña */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View
                  style={[
                    styles.strengthBar,
                    {
                      width: `${(strength / 4) * 100}%`,
                      backgroundColor: strengthColor,
                    },
                  ]}
                />
                <Text style={[styles.strengthText, { color: strengthColor }]}>
                  {strengthText}
                </Text>
              </View>
            )}

            {/* Confirmar Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={COLORS.textMuted}
                style={styles.icon}
              />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                placeholder="Confirmar contraseña"
                placeholderTextColor={COLORS.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            {/* Términos y condiciones */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAceptaTerminos(!aceptaTerminos)}
            >
              <Ionicons
                name={aceptaTerminos ? "checkbox" : "square-outline"}
                size={24}
                color={aceptaTerminos ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={styles.termsText}>
                Acepto los términos y condiciones de Vision360
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || !aceptaTerminos) && { opacity: 0.5 },
              ]}
              onPress={handleRegistro}
              disabled={loading || !aceptaTerminos}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>REGISTRARSE</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 8, 18, 0.8)",
  },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingTop: 60,
  },
  backButton: { position: "absolute", top: 50, left: 20, zIndex: 10 },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 30,
  },
  card: {
    backgroundColor: "rgba(19, 24, 37, 0.95)",
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputWrapper: {
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
  icon: { marginRight: 10 },
  input: { flex: 1, color: COLORS.text, fontSize: 15, height: "100%" },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  strengthBar: { height: 4, borderRadius: 2, flex: 1, marginRight: 10 },
  strengthText: { fontSize: 12, fontWeight: "bold" },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  termsText: { color: COLORS.textMuted, fontSize: 12, marginLeft: 10, flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
});
