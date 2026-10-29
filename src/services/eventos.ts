import { supabase } from "./supabase";

// Interfaz basada exactamente en tu tabla 'evento'
export interface Evento {
  id_evento?: number;
  tipo: string;
  descripcion: string;
  fecha_hora: string;
  nivel?: string;
  lugar: string;
  usuario: string;
  captura_url?: string;
  id_barrio?: number;
  estado_alarma?: string;
}

export const obtenerEventos = async () => {
  const { data, error } = await supabase
    .from("evento") // 👈 Tu tabla se llama 'evento'
    .select("*")
    .order("fecha_hora", { ascending: false }); // 👈 Ordenamos por 'fecha_hora'

  if (error) {
    console.error("Error al obtener eventos:", error);
    throw error;
  }
  return data as Evento[];
};

export const obtenerEventoPorId = async (id: string) => {
  const { data, error } = await supabase
    .from("evento")
    .select("*")
    .eq("id_evento", id) // 👈 La PK es 'id_evento'
    .single();

  if (error) throw error;
  return data as Evento;
};

export const crearEvento = async (
  evento: Omit<Evento, "id_evento" | "estado_alarma">,
): Promise<Evento> => {
  const { data, error } = await supabase
    .from("evento")
    .insert([evento])
    .select()
    .single();

  if (error) throw error;
  return data as Evento;
};
