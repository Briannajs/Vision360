import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { cerrarSesion } from "../../services/auth";
import { supabase } from "../../services/supabase";
import { COLORS } from "../../theme/colors";

export default function SuperAdminDashboard() {
  const [tabActiva, setTabActiva] = useState<"barrios" | "usuarios">("barrios");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [barrios, setBarrios] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  // Filtros y búsquedas
  const [busqueda, setBusqueda] = useState("");
  const [busquedaBarrio, setBusquedaBarrio] = useState("");
  const [ordenAsc, setOrdenAsc] = useState(true);
  const [filtroSinBarrio, setFiltroSinBarrio] = useState(false);

  // Expansión de barrios
  const [barrioExpandido, setBarrioExpandido] = useState<number | null>(null);

  // Modales
  const [modalCrearBarrio, setModalCrearBarrio] = useState(false);
  const [nuevoBarrioNombre, setNuevoBarrioNombre] = useState("");
  const [modalAsignar, setModalAsignar] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<any>(null);

  // Estadísticas calculadas
  const totalUsuarios = usuarios.length;
  const usuariosSinBarrio = usuarios.filter((u) => !u.id_barrio).length;
  const totalBarrios = barrios.length;
  const totalAdmins = usuarios.filter(
    (u) => u.rol === "admin" || u.rol === "superadmin",
  ).length;

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: barriosData, error: errB } = await supabase
        .from("barrios")
        .select("*")
        .order("nombre", { ascending: true });
      if (errB) console.error("Error barrios:", errB);
      setBarrios(barriosData || []);

      const { data: usuariosData, error: errU } = await supabase
        .from("perfiles")
        .select("*, barrios(nombre)")
        .order("nombre_completo", { ascending: true });
      if (errU) console.error("Error usuarios:", errU);
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const copiarCodigo = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo);
    Alert.alert("✅ Copiado", "El código se copió al portapapeles.");
  };

  const eliminarBarrio = (idBarrio: number) => {
    Alert.alert(
      "⚠️ Eliminar Barrio",
      "¿Estás seguro? Los usuarios quedarán sin barrio.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("barrios")
              .delete()
              .eq("id_barrio", idBarrio);
            if (error) Alert.alert("Error", error.message);
            else cargarDatos();
          },
        },
      ],
    );
  };

  const crearBarrio = async () => {
    if (!nuevoBarrioNombre) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nuevoCodigo = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      const { error } = await supabase
        .from("barrios")
        .insert([
          {
            nombre: nuevoBarrioNombre,
            codigo_invitacion: nuevoCodigo,
            id_admin: user?.id,
          },
        ]);
      if (error) throw error;
      Alert.alert("✅ Barrio Creado", `Código: ${nuevoCodigo}`);
      setModalCrearBarrio(false);
      setNuevoBarrioNombre("");
      await cargarDatos();
    } catch (error: any) {
      Alert.alert("Error al crear", error.message);
    }
  };

  const asignarBarrio = async (idBarrio: number) => {
    if (!usuarioSeleccionado) return;
    try {
      const { error } = await supabase
        .from("perfiles")
        .update({ id_barrio: idBarrio })
        .eq("id", usuarioSeleccionado.id);
      if (error) throw error;
      Alert.alert("✅ Asignado", "Usuario asignado correctamente.");
      setModalAsignar(false);
      cargarDatos();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const eliminarUsuario = (id: string) => {
    Alert.alert("⚠️ Eliminar", "¿Borrar este perfil?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await supabase.from("perfiles").delete().eq("id", id);
          cargarDatos();
        },
      },
    ]);
  };

  // Filtrar barrios
  const barriosFiltrados = barrios.filter((b) =>
    b.nombre.toLowerCase().includes(busquedaBarrio.toLowerCase()),
  );

  // Filtrar usuarios
  const usuariosFiltrados = usuarios
    .filter((u) => {
      const matchBusqueda =
        u.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.id.toLowerCase().includes(busqueda.toLowerCase());
      const matchSinBarrio = filtroSinBarrio ? !u.id_barrio : true;
      return matchBusqueda && matchSinBarrio;
    })
    .sort((a, b) => {
      const nombreA = a.nombre_completo || "";
      const nombreB = b.nombre_completo || "";
      return ordenAsc
        ? nombreA.localeCompare(nombreB)
        : nombreB.localeCompare(nombreA);
    });

  const getIconoRol = (rol: string) => {
    if (rol === "superadmin") return "shield-checkmark";
    if (rol === "admin") return "shield";
    return "person";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel de Control</Text>
          <Text style={styles.headerSub}>Vision360 Admin (Real)</Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await cerrarSesion();
            router.replace("/login");
          }}
          style={styles.logoutIcon}
        >
          <Ionicons name="log-out-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* ESTADÍSTICAS RÁPIDAS (4 tarjetas) */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalBarrios}</Text>
          <Text style={styles.statLabel}>Barrios</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalUsuarios}</Text>
          <Text style={styles.statLabel}>Usuarios</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{usuariosSinBarrio}</Text>
          <Text style={styles.statLabel}>Sin Barrio</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalAdmins}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tabActiva === "barrios" && styles.tabActive]}
          onPress={() => setTabActiva("barrios")}
        >
          <Text
            style={[
              styles.tabText,
              tabActiva === "barrios" && styles.tabTextActive,
            ]}
          >
            Barrios ({barrios.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tabActiva === "usuarios" && styles.tabActive]}
          onPress={() => setTabActiva("usuarios")}
        >
          <Text
            style={[
              styles.tabText,
              tabActiva === "usuarios" && styles.tabTextActive,
            ]}
          >
            Usuarios ({usuarios.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* PESTAÑA BARRIOS */}
          {tabActiva === "barrios" && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar barrio..."
                  placeholderTextColor={COLORS.textMuted}
                  value={busquedaBarrio}
                  onChangeText={setBusquedaBarrio}
                />
              </View>

              <TouchableOpacity
                style={styles.crearBtn}
                onPress={() => setModalCrearBarrio(true)}
              >
                <Ionicons name="add-circle" size={20} color={COLORS.text} />
                <Text style={styles.crearBtnText}>Crear Nuevo Barrio</Text>
              </TouchableOpacity>

              <FlatList
                data={barriosFiltrados}
                keyExtractor={(item) => item.id_barrio.toString()}
                contentContainerStyle={{ padding: 20 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      cargarDatos();
                    }}
                  />
                }
                renderItem={({ item }) => {
                  const vecinosDelBarrio = usuarios.filter(
                    (u) => u.id_barrio === item.id_barrio,
                  );
                  const estaExpandido = barrioExpandido === item.id_barrio;
                  return (
                    <View style={styles.card}>
                      <TouchableOpacity
                        style={styles.rowBetween}
                        onPress={() =>
                          setBarrioExpandido(
                            estaExpandido ? null : item.id_barrio,
                          )
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{item.nombre}</Text>
                          <Text style={styles.cardInfo}>
                            Código:{" "}
                            <Text
                              style={{
                                color: COLORS.primary,
                                fontWeight: "bold",
                              }}
                            >
                              {item.codigo_invitacion}
                            </Text>
                          </Text>
                        </View>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {vecinosDelBarrio.length} Vecinos
                            </Text>
                          </View>
                          <Ionicons
                            name={estaExpandido ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={COLORS.textMuted}
                            style={{ marginLeft: 10 }}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* ACCIONES DEL BARRIO */}
                      <View style={styles.barrioActions}>
                        <TouchableOpacity
                          onPress={() => copiarCodigo(item.codigo_invitacion)}
                          style={{ marginRight: 15 }}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={20}
                            color={COLORS.textMuted}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => eliminarBarrio(item.id_barrio)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color={COLORS.danger}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* LISTA DE VECINOS (SE MUESTRA AL EXPANDIR) */}
                      {estaExpandido && (
                        <View style={styles.expandedContainer}>
                          <Text style={styles.expandedTitle}>
                            VECINOS ASIGNADOS:
                          </Text>
                          {vecinosDelBarrio.length === 0 ? (
                            <Text style={styles.noVecinosText}>
                              No hay vecinos asignados.
                            </Text>
                          ) : (
                            vecinosDelBarrio.map((vecino) => (
                              <View key={vecino.id} style={styles.vecinoRow}>
                                <View style={styles.miniAvatar}>
                                  <Text style={styles.miniAvatarText}>
                                    {vecino.nombre_completo?.charAt(0) || "?"}
                                  </Text>
                                </View>
                                <Text style={styles.vecinoName}>
                                  {vecino.nombre_completo}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => eliminarUsuario(vecino.id)}
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={18}
                                    color={COLORS.danger}
                                  />
                                </TouchableOpacity>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    No hay barrios creados aún.
                  </Text>
                }
              />
            </View>
          )}

          {/* PESTAÑA USUARIOS */}
          {tabActiva === "usuarios" && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar usuario..."
                  placeholderTextColor={COLORS.textMuted}
                  value={busqueda}
                  onChangeText={setBusqueda}
                />
                <TouchableOpacity
                  onPress={() => setOrdenAsc(!ordenAsc)}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons
                    name={ordenAsc ? "arrow-up" : "arrow-down"}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFiltroSinBarrio(!filtroSinBarrio)}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons
                    name={filtroSinBarrio ? "filter" : "filter-outline"}
                    size={20}
                    color={filtroSinBarrio ? COLORS.primary : COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <FlatList
                data={usuariosFiltrados}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20, paddingTop: 10 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      cargarDatos();
                    }}
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.userCard}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {item.nombre_completo?.charAt(0) || "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Ionicons
                          name={getIconoRol(item.rol)}
                          size={14}
                          color={
                            item.rol === "superadmin"
                              ? COLORS.warning
                              : item.rol === "admin"
                                ? COLORS.primary
                                : COLORS.textMuted
                          }
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.userName}>
                          {item.nombre_completo || "Sin Nombre"}
                        </Text>
                      </View>
                      <Text style={styles.userRole}>
                        {item.rol?.toUpperCase()} •{" "}
                        {item.barrios?.nombre || "Sin Barrio"}
                      </Text>
                    </View>
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setUsuarioSeleccionado(item);
                          setModalAsignar(true);
                        }}
                      >
                        <Ionicons
                          name="swap-horizontal"
                          size={20}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => eliminarUsuario(item.id)}
                      >
                        <Ionicons
                          name="trash"
                          size={20}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    No se encontraron usuarios.
                  </Text>
                }
              />
            </View>
          )}
        </View>
      )}

      {/* MODAL CREAR BARRIO */}
      <Modal visible={modalCrearBarrio} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Barrio</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre del barrio"
              placeholderTextColor={COLORS.textMuted}
              value={nuevoBarrioNombre}
              onChangeText={setNuevoBarrioNombre}
              maxLength={50}
            />
            <Text
              style={{
                color: COLORS.textMuted,
                alignSelf: "flex-end",
                marginBottom: 10,
              }}
            >
              {nuevoBarrioNombre.length}/50
            </Text>
            <TouchableOpacity
              style={[
                styles.modalBtnPrimary,
                !nuevoBarrioNombre && { opacity: 0.5 },
              ]}
              onPress={crearBarrio}
              disabled={!nuevoBarrioNombre}
            >
              <Text style={styles.modalBtnText}>CREAR BARRIO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalCrearBarrio(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ASIGNAR */}
      <Modal visible={modalAsignar} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Asignar Barrio a {usuarioSeleccionado?.nombre_completo}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {barrios.map((b) => (
                <TouchableOpacity
                  key={b.id_barrio}
                  style={styles.modalItem}
                  onPress={() => asignarBarrio(b.id_barrio)}
                >
                  <Text style={styles.modalItemText}>{b.nombre}</Text>
                  <Text style={styles.modalItemCode}>
                    {b.codigo_invitacion}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalAsignar(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: "bold" },
  headerSub: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },
  logoutIcon: { padding: 5 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statCard: { alignItems: "center" },
  statNumber: { color: COLORS.text, fontSize: 22, fontWeight: "bold" },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  tabsContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: COLORS.inputBg,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textMuted, fontWeight: "bold", fontSize: 13 },
  tabTextActive: { color: COLORS.text },
  crearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  crearBtnText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
  cardInfo: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  badge: {
    backgroundColor: "rgba(211, 47, 47, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "bold" },

  barrioActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  expandedContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  expandedTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
  },
  vecinoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: COLORS.inputBg,
    padding: 10,
    borderRadius: 8,
  },
  miniAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  miniAvatarText: { color: COLORS.text, fontSize: 14, fontWeight: "bold" },
  vecinoName: { flex: 1, color: COLORS.text, fontSize: 14 },
  noVecinosText: { color: COLORS.textMuted, fontSize: 13, fontStyle: "italic" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginTop: 15,
    paddingHorizontal: 15,
    height: 45,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.text, marginLeft: 10 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarText: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
  userName: { color: COLORS.text, fontSize: 15, fontWeight: "bold" },
  userRole: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  actionsRow: { flexDirection: "row" },
  actionBtn: {
    padding: 8,
    marginLeft: 5,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 30,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.text,
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { color: COLORS.text, fontWeight: "bold" },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalItemText: { color: COLORS.text, fontWeight: "bold" },
  modalItemCode: { color: COLORS.primary, fontWeight: "bold" },
  modalCloseBtn: { marginTop: 15, padding: 15, alignItems: "center" },
  modalCloseText: { color: COLORS.danger, fontWeight: "bold", fontSize: 16 },
});
