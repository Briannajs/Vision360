import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Evento, obtenerEventos } from "../../services/eventos";
import { COLORS } from "../../theme/colors";

type FiltroFecha = "todos" | "hoy" | "semana";
type FiltroTipo = "todos" | "panico" | "movimiento" | "manual";

const OPCIONES_FECHA: { valor: FiltroFecha; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "TODO" },
  { valor: "hoy", etiqueta: "HOY" },
  { valor: "semana", etiqueta: "SEMANA" },
];

const OPCIONES_TIPO: { valor: FiltroTipo; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "TODOS" },
  { valor: "panico", etiqueta: "PÁNICO" },
  { valor: "movimiento", etiqueta: "MOVIMIENTO" },
  { valor: "manual", etiqueta: "MANUAL" },
];

export default function MiViviendaScreen() {
  const insets = useSafeAreaInsets();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>("todos");

  const cargarEventos = async () => {
    try {
      const data = await obtenerEventos();
      setEventos(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarEventos();
    }, []),
  );

  // Lógica de filtrado
  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => {
      const matchTexto =
        e.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.lugar?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.usuario?.toLowerCase().includes(busqueda.toLowerCase());

      const matchTipo = filtroTipo === "todos" || e.tipo === filtroTipo;

      let matchFecha = true;
      if (filtroFecha === "hoy")
        matchFecha =
          new Date(e.fecha_hora).toDateString() === new Date().toDateString();
      if (filtroFecha === "semana") {
        const diff = new Date().getTime() - new Date(e.fecha_hora).getTime();
        matchFecha = diff < 7 * 24 * 60 * 60 * 1000;
      }

      return matchTexto && matchTipo && matchFecha;
    });
  }, [eventos, busqueda, filtroTipo, filtroFecha]);

  const criticos = eventosFiltrados.filter((e) => e.tipo === "panico").length;

  const renderEvento = ({ item }: { item: Evento }) => {
    const fecha = new Date(item.fecha_hora);
    const esPanico = item.tipo === "panico";
    const esMovimiento = item.tipo === "movimiento";
    const colorBorde = esPanico
      ? COLORS.primary
      : esMovimiento
        ? COLORS.warning
        : COLORS.success;

    return (
      <TouchableOpacity
        style={[styles.eventCard, { borderLeftColor: colorBorde }]}
        onPress={() =>
          router.push({
            pathname: "/detalle-evento",
            params: { id: item.id_evento },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name={esPanico ? "alert-circle" : esMovimiento ? "walk" : "create"}
            size={20}
            color={colorBorde}
          />
          <Text style={[styles.cardType, { color: colorBorde }]}>
            {item.tipo?.toUpperCase()}
          </Text>
          <Text style={styles.cardTime}>
            {fecha.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.descripcion || "Sin descripción"}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.cardMeta}>
            <Ionicons
              name="location-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {item.lugar || "Barrio"}
            </Text>
          </View>
          <View style={[styles.cardMeta, styles.cardMetaUser]}>
            <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {item.usuario || "Vecino"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header y Estadísticas */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.headerTitle}>Historial de Eventos</Text>
          <Text style={styles.headerSub}>
            {eventosFiltrados.length} eventos • {criticos} críticos
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/crear-evento" as any)}
        >
          <Ionicons name="add" size={28} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Buscador y Filtros */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.textMuted}
          style={{ marginLeft: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por lugar, usuario..."
          placeholderTextColor={COLORS.textMuted}
          value={busqueda}
          onChangeText={setBusqueda}
          selectionColor={COLORS.primaryLight}
          cursorColor={COLORS.primaryLight}
          keyboardAppearance="dark"
          returnKeyType="search"
          autoCorrect={false}
          textAlignVertical="center"
        />
        {busqueda !== "" && (
          <TouchableOpacity onPress={() => setBusqueda("")}>
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textMuted}
              style={{ marginRight: 10 }}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtros}>
        <View style={styles.filtroGrupo}>
          <Text style={styles.filtroLabel}>FECHA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {OPCIONES_FECHA.map(({ valor, etiqueta }) => {
              const activo = filtroFecha === valor;
              return (
                <TouchableOpacity
                  key={valor}
                  style={[styles.chip, activo && styles.chipActivo]}
                  onPress={() => setFiltroFecha(valor)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipTexto, activo && styles.chipTextoActivo]}
                  >
                    {etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.filtroGrupo}>
          <Text style={styles.filtroLabel}>TIPO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {OPCIONES_TIPO.map(({ valor, etiqueta }) => {
              const activo = filtroTipo === valor;
              return (
                <TouchableOpacity
                  key={valor}
                  style={[styles.chip, activo && styles.chipActivo]}
                  onPress={() => setFiltroTipo(valor)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipTexto, activo && styles.chipTextoActivo]}
                  >
                    {etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Lista de Eventos */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={eventosFiltrados}
          keyExtractor={(item) => item.id_evento!.toString()}
          renderItem={renderEvento}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 15, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                cargarEventos();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="document-text-outline"
                size={60}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyText}>No se encontraron eventos</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { color: COLORS.text, fontSize: 26, fontWeight: "bold" },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  fab: {
    backgroundColor: COLORS.primary,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceLight,
    marginHorizontal: 20,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingRight: 6,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    marginLeft: 10,
    fontSize: 16,
    paddingVertical: 0,
  },
  filtros: { marginTop: 14 },
  filtroGrupo: { marginBottom: 10 },
  filtroLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 20,
  },
  chipsScroll: { flexGrow: 0 },
  chipsRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  chipTexto: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  chipTextoActivo: { color: COLORS.text },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 5,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardType: { fontSize: 12, fontWeight: "bold", marginLeft: 6, flex: 1 },
  cardTime: { color: COLORS.textMuted, fontSize: 11 },
  cardDesc: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  cardMetaUser: { marginLeft: 12, flexShrink: 0, maxWidth: "45%" },
  cardMetaText: { color: COLORS.textMuted, fontSize: 12, flexShrink: 1 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, marginTop: 15 },
});
