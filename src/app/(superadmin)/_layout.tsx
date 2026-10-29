import { Stack } from "expo-router";
import { COLORS } from "../../theme/colors";

export default function SuperAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="dashboard" />
    </Stack>
  );
}
