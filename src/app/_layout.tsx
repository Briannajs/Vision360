import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { COLORS } from "../theme/colors";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="recuperar-password" />
        <Stack.Screen name="seleccion-barrio" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(superadmin)" />
      </Stack>
    </>
  );
}
