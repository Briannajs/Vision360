const API_URL = "http:// 192.168.1.15:3000";

export async function comprobarServidor() {
  try {
    const respuesta = await fetch(`${API_URL}/api/estado`);

    if (!respuesta.ok) {
      throw new Error("Error al consultar el servidor");
    }

    const datos = await respuesta.json();
    return datos;
  } catch (error) {
    console.error("Error de conexión:", error);
    throw error;
  }
}
