import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Digital Assassin" }} />
      <Stack.Screen name="host" options={{ title: "Host Match" }} />
      <Stack.Screen name="join" options={{ title: "Join Match" }} />
    </Stack>
  );
}
