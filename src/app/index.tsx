import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../services/supabase";
import { COLORS } from "../theme/colors";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Si hay usuario, lo mandamos al panel o a las alarmas según su rol
  // (Podés simplificarlo y mandarlo directo a /login si preferís)
  if (user) {
    // Asumimos que si está logueado, va al inicio de las tabs
    return <Redirect href="/(tabs)/mi-barrio" />;
  }

  // Si no hay usuario, va al login
  return <Redirect href="/login" />;
}
