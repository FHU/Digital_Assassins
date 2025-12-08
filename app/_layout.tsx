import { Stack } from "expo-router";
import { useEffect } from "react";
import { BleManager } from "react-native-ble-plx";

export default function RootLayout() {
  // Request Bluetooth permissions on app launch
  useEffect(() => {
    const requestBluetoothOnLaunch = async () => {
      try {
        const bleManager = new BleManager();

        // Starting a scan will trigger the iOS Bluetooth permission dialog
        console.log("Requesting Bluetooth permission...");
        bleManager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            console.log("Bluetooth scan error (expected on first run):", error.message);
          }
        });

        // Stop scanning immediately
        setTimeout(() => {
          bleManager.stopDeviceScan();
          bleManager.destroy();
          console.log("✓ Bluetooth permission requested");
        }, 1000);
      } catch (error) {
        console.log("Bluetooth initialization:", error);
      }
    };

    requestBluetoothOnLaunch();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Digital Assassin" }} />
      <Stack.Screen name="host" options={{ title: "Host Match" }} />
      <Stack.Screen name="join" options={{ title: "Join Match" }} />
      <Stack.Screen name="join_lobby" options={{ title: "Join Lobby" }} />
      <Stack.Screen name="waiting_lobby" options={{ title: "Waiting Lobby" }} />
    </Stack>
  );
}
