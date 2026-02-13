import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// Keep splash screen visible while app loads
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen once layout is mounted
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Digital Assassin" }} />
      <Stack.Screen name="host_page" options={{ headerShown: false }} />
      <Stack.Screen name="join" options={{ title: "Join Match" }} />
      <Stack.Screen name="join_lobby" options={{ title: "Join Lobby" }} />
      <Stack.Screen name="waiting_lobby" options={{ title: "Waiting Lobby" }} />
      <Stack.Screen name="ble-scanning" options={{ title: "Game Active" }} />
    </Stack>
  );
}
