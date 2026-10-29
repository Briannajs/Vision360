import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { COLORS } from "../../theme/colors";

interface Mensaje {
  id: number;
  usuario_id: string;
  usuario_nombre: string;
  texto: string;
  created_at: string;
}

/** Cada cuánto se vuelven a pedir los mensajes si Realtime no está activo. */
const SONDEO_MS = 5000;

function ordenarPorFecha(lista: Mensaje[]) {
  return [...lista].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Une listas sin duplicar mensajes (Realtime + sondeo + envío propio). */
function fusionar(previos: Mensaje[], nuevos: Mensaje[]) {
  const porId = new Map<number, Mensaje>();
  for (const mensaje of previos) porId.set(mensaje.id, mensaje);
  for (const mensaje of nuevos) porId.set(mensaje.id, mensaje);
  return ordenarPorFecha([...porId.values()]);
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [barrio, setBarrio] = useState<any>(null);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [errorMensajes, setErrorMensajes] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargarMensajes = useCallback(
    async (idBarrio: string, mostrarSpinner = false) => {
      if (mostrarSpinner) setRefrescando(true);

      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("id_barrio", idBarrio)
        .order("created_at", { ascending: true });

      if (!montado.current) return;
      if (mostrarSpinner) setRefrescando(false);

      if (error) {
        setErrorMensajes(error.message);
        return;
      }

      setErrorMensajes(null);
      if (data) {
        setMensajes((previos) => fusionar(previos, data as Mensaje[]));
      }
    },
    [],
  );

  useEffect(() => {
    let activo = true;
    let sondeo: ReturnType<typeof setInterval> | null = null;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    const inicializar = async () => {
      const {
        data: { user: usuario },
      } = await supabase.auth.getUser();

      if (!activo) return;
      setUser(usuario);

      if (!usuario) {
        setLoading(false);
        return;
      }

      const { data: perfilData, error: errorConsulta } = await supabase
        .from("perfiles")
        .select("*, barrios(nombre)")
        .eq("id", usuario.id)
        .single();

      if (!activo) return;

      if (errorConsulta) {
        // Si falla la consulta no es que "no tenga barrio": es otro problema.
        setErrorPerfil(errorConsulta.message);
        setLoading(false);
        return;
      }

      setPerfil(perfilData);
      if (perfilData?.barrios) setBarrio(perfilData.barrios);

      if (perfilData?.id_barrio) {
        const idBarrio = perfilData.id_barrio;

        await cargarMensajes(idBarrio);

        canal = supabase
          .channel(`chat_${idBarrio}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "mensajes",
              filter: `id_barrio=eq.${idBarrio}`,
            },
            (payload) => {
              if (!montado.current) return;
              setMensajes((previos) =>
                fusionar(previos, [payload.new as Mensaje]),
              );
            },
          )
          .subscribe();

        // Respaldo: si Realtime no está habilitado en `mensajes`, los
        // mensajes igual aparecen en unos segundos.
        sondeo = setInterval(() => cargarMensajes(idBarrio), SONDEO_MS);
      }

      if (activo) setLoading(false);
    };

    inicializar();

    return () => {
      activo = false;
      if (sondeo) clearInterval(sondeo);
      if (canal) supabase.removeChannel(canal);
    };
  }, [cargarMensajes]);

  const enviarMensaje = async () => {
    const texto = nuevoMensaje.trim();
    if (!texto || !user || !perfil?.id_barrio || enviando) return;

    setEnviando(true);

    const { data, error } = await supabase
      .from("mensajes")
      .insert([
        {
          id_barrio: perfil.id_barrio,
          usuario_id: user.id,
          usuario_nombre: user.user_metadata?.nombre_completo || "Vecino",
          texto,
        },
      ])
      .select()
      .single();

    setEnviando(false);

    if (error) {
      Alert.alert("No se pudo enviar", error.message);
      return;
    }

    // Lo mostramos al instante, sin esperar a Realtime.
    setNuevoMensaje("");
    if (data) {
      setMensajes((previos) => fusionar(previos, [data as Mensaje]));
    }
  };

  const refrescar = async () => {
    if (perfil?.id_barrio) await cargarMensajes(perfil.id_barrio, true);
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );

  // Falló la consulta del perfil: mostramos el motivo real.
  if (errorPerfil) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline" size={80} color={COLORS.warning} />
        <Text style={styles.blockTitle}>No se pudo cargar tu perfil</Text>
        <Text style={styles.blockSub}>{errorPerfil}</Text>
        <TouchableOpacity
          style={styles.goToBarrioBtn}
          onPress={() => router.replace("/(tabs)/mi-barrio")}
        >
          <Text style={styles.goToBarrioText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Sin sesión iniciada.
  if (!user) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={80} color={COLORS.primary} />
        <Text style={styles.blockTitle}>Iniciá sesión</Text>
        <Text style={styles.blockSub}>
          Necesitás una cuenta para usar el chat del barrio.
        </Text>
        <TouchableOpacity
          style={styles.goToBarrioBtn}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.goToBarrioText}>Ir al inicio de sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🔒 BLOQUEO: Si no tiene barrio, no puede usar el chat
  if (!perfil?.id_barrio) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={80} color={COLORS.primary} />
        <Text style={styles.blockTitle}>Chat Bloqueado</Text>
        <Text style={styles.blockSub}>
          Necesitás unirte a un barrio con un código de invitación para chatear
          con tus vecinos.
        </Text>
        <TouchableOpacity
          style={styles.goToBarrioBtn}
          onPress={() => router.replace("/seleccion-barrio")}
        >
          <Text style={styles.goToBarrioText}>Ingresar Código de Barrio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      // Con edge-to-edge el teclado ya no achica la ventana en Android:
      // el padding calculado por KeyboardAvoidingView es lo que sube el input.
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.headerTitle}>Chat Vecinal</Text>
          <Text style={styles.headerSubtitle}>{barrio?.nombre}</Text>
        </View>
      </View>

      {errorMensajes && (
        <TouchableOpacity style={styles.errorBanner} onPress={refrescar}>
          <Ionicons name="warning-outline" size={16} color={COLORS.text} />
          <Text style={styles.errorBannerText}>
            No se pudieron cargar los mensajes. Tocá para reintentar.
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={mensajes}
        keyExtractor={(item) => item.id.toString()}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 15, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={54}
              color={COLORS.textDim}
            />
            <Text style={styles.emptyText}>
              Todavía no hay mensajes en tu barrio. Escribí el primero.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const esMio = item.usuario_id === user?.id;
          return (
            <View
              style={[
                styles.bubble,
                esMio ? styles.myBubble : styles.otherBubble,
              ]}
            >
              {!esMio && (
                <Text style={styles.userName}>{item.usuario_nombre}</Text>
              )}
              <Text style={styles.messageText}>{item.texto}</Text>
              <Text style={styles.messageTime}>
                {new Date(item.created_at).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Escribí un mensaje..."
          placeholderTextColor={COLORS.textMuted}
          value={nuevoMensaje}
          onChangeText={setNuevoMensaje}
          editable={!enviando}
          multiline
          maxLength={1000}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={enviarMensaje}
          selectionColor={COLORS.primaryLight}
          cursorColor={COLORS.primaryLight}
          keyboardAppearance="dark"
          textAlignVertical="center"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!nuevoMensaje.trim() || enviando) && { opacity: 0.5 },
          ]}
          onPress={enviarMensaje}
          disabled={!nuevoMensaje.trim() || enviando}
        >
          {enviando ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.text} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    textAlign: "center",
  },
  blockSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  goToBarrioBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  goToBarrioText: { color: COLORS.text, fontWeight: "bold", fontSize: 16 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: "bold" },
  headerSubtitle: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "bold",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: { color: COLORS.text, fontSize: 12, flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 15, marginBottom: 10 },
  myBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: COLORS.surface,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
  },
  userName: {
    color: COLORS.primaryLight || "#ff8a80",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  messageText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  messageTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  inputBar: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    marginRight: 10,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 46,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
