import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Falta la URL o la clave pública de Supabase en el entorno");
}

console.log("Supabase URL:", supabaseUrl);
console.log(
  "URL sin ruta adicional:",
  /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl),
);

// Adaptador para móviles (SecureStore)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Adaptador para web (localStorage) con protección para el servidor
const WebAdapter = {
  getItem: (key: string) => {
    if (typeof localStorage === "undefined") return null; // 👈 Evita el error en el servidor
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  },
};

const storageAdapter =
  Platform.OS === "web" ? WebAdapter : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
