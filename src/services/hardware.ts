import { supabase } from "./supabase";

export type ComandoHardware = "silenciar" | "detener";

export type EstadoAlarma = "activa" | "silenciada" | "detenida";

export interface AlarmaActual {
  id_evento: number;
  tipo: string;
  estado_alarma: string;
  fecha_hora: string;
  id_barrio?: string | null;
}

/** Tipos de evento que hacen sonar el ESP32. */
export const TIPOS_ALARMA = ["panico", "incendio", "emergencia"] as const;

/** Barrio del usuario logueado (null si todavía no se unió a ninguno). */
const barrioDelUsuario = async (): Promise<string | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("perfiles")
    .select("id_barrio")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.id_barrio ?? null;
};

/**
 * Última alarma registrada en la tabla `evento`.
 *
 * Se filtra por el barrio para que CUALQUIER celular del barrio vea la
 * alarma en curso y pueda silenciarla o detenerla, no solo el que la
 * disparó. El ESP32 se guía por el mismo registro y su columna
 * `estado_alarma`.
 *
 * @param idBarrio Si se omite, se usa el barrio del usuario logueado.
 */
export const obtenerAlarmaActual = async (
  idBarrio?: string | null,
): Promise<AlarmaActual | null> => {
  const barrio = idBarrio === undefined ? await barrioDelUsuario() : idBarrio;

  // Sin barrio no hay alarma que controlar.
  if (!barrio) return null;

  const { data, error } = await supabase
    .from("evento")
    .select("id_evento, tipo, estado_alarma, fecha_hora, id_barrio")
    .in("tipo", TIPOS_ALARMA)
    .eq("id_barrio", barrio)
    .order("id_evento", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AlarmaActual | null;
};

/**
 * Cambia el estado de la alarma. El ESP32 lo lee en su próxima
 * consulta (cada ~2 segundos) y actúa sobre el hardware.
 *
 * - silenciar -> "silenciada": apaga el buzzer, deja luces y relay.
 * - detener   -> "detenida": apaga todo.
 *
 * Cualquier vecino del barrio puede ejecutarlo: el RPC valida que el
 * evento pertenezca a su barrio, no que sea suyo.
 */
export const enviarComandoHardware = async (
  idEvento: number,
  comando: ComandoHardware,
) => {
  const { error } = await supabase.rpc("marcar_estado_alarma", {
    p_id_evento: idEvento,
    p_estado: comando === "detener" ? "detenida" : "silenciada",
  });

  if (error) throw error;
};
