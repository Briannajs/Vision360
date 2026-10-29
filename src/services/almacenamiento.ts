import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * En el celular usamos SecureStore (cifrado del sistema).
 * En la web SecureStore no existe, así que usamos localStorage.
 * La app del celular se comporta exactamente igual que antes.
 */
const esWeb = Platform.OS === "web";
const CLAVE = "lastEmail";

export const guardarUltimoEmail = async (email: string) => {
  if (esWeb) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CLAVE, email);
    }
    return;
  }
  await SecureStore.setItemAsync(CLAVE, email);
};

export const obtenerUltimoEmail = async () => {
  if (esWeb) {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(CLAVE)
      : null;
  }
  return SecureStore.getItemAsync(CLAVE);
};

export const borrarUltimoEmail = async () => {
  if (esWeb) {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(CLAVE);
    }
    return;
  }
  await SecureStore.deleteItemAsync(CLAVE);
};
