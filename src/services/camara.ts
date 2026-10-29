import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CLAVE = "vision360.camara.url";
const ES_WEB = Platform.OS === "web";

/**
 * Deja la URL base prolija: sin barras finales y sin las rutas
 * del stream o de la captura, para poder pegarla tal cual desde
 * la ventana del servidor de la PC.
 */
export function normalizarBase(valor: string): string {
  let base = (valor || "").trim();

  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;

  base = base.replace(/\/+$/, "");
  base = base.replace(/\/live\.m3u8$/i, "");
  base = base.replace(/\/snapshot(\.jpg)?$/i, "");
  base = base.replace(/\/+(live\.m3u8|snapshot(\.jpg)?)$/i, "");

  return base;
}

export function urlsCamara(base: string) {
  const limpia = normalizarBase(base);

  return {
    base: limpia,
    hls: limpia ? `${limpia}/live.m3u8` : "",
    snapshot: limpia ? `${limpia}/snapshot` : "",
    pagina: limpia ? `${limpia}/?embed=1` : "",
  };
}

/** URL por defecto, por si se define EXPO_PUBLIC_CAMARA_URL en el .env */
export function urlPorDefecto(): string {
  return normalizarBase(process.env.EXPO_PUBLIC_CAMARA_URL?.trim() || "");
}

export async function leerUrlCamara(): Promise<string> {
  if (ES_WEB) {
    try {
      return window.localStorage.getItem(CLAVE) || "";
    } catch {
      return "";
    }
  }

  try {
    return (await SecureStore.getItemAsync(CLAVE)) || "";
  } catch {
    return "";
  }
}

export async function guardarUrlCamara(valor: string): Promise<void> {
  const base = normalizarBase(valor);

  if (ES_WEB) {
    try {
      if (base) window.localStorage.setItem(CLAVE, base);
      else window.localStorage.removeItem(CLAVE);
    } catch {}
    return;
  }

  if (base) await SecureStore.setItemAsync(CLAVE, base);
  else await SecureStore.deleteItemAsync(CLAVE);
}
