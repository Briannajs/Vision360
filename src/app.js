import React, { useState } from "react";
import { View, Text, Button } from "react-native";
import { comprobarServidor } from "./api";

export default function App() {
  const [mensaje, setMensaje] = useState("Sin conectar");

  async function probarConexion() {
    try {
      const datos = await comprobarServidor();
      setMensaje(datos.mensaje);
    } catch {
      setMensaje("No se pudo conectar al servidor");
    }
  }

  return (
    <View style={{ padding: 30, marginTop: 50 }}>
      <Text>Estado: {mensaje}</Text>

      <Button title="Probar conexión" onPress={probarConexion} />
    </View>
  );
}
