import { BleManager } from "react-native-ble-plx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Linking, Alert } from "react-native";
import * as Permissions from "expo-permissions";

export function useBluetooth() {
  const bleManagerRef = useRef<BleManager | null>(null);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    initBluetooth();
    return () => {
      if (bleManagerRef.current) {
        bleManagerRef.current.destroy();
      }
    };
  }, []);

  const initBluetooth = async () => {
    try {
      bleManagerRef.current = new BleManager();
      const state = await bleManagerRef.current.state();
      setIsBluetoothEnabled(state === "PoweredOn");
    } catch (error) {
      console.error("Error initializing Bluetooth:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const requestBluetoothPermissions = async () => {
    try {
      if (Platform.OS === "ios") {
        // iOS handles permissions through NSBluetoothPeripheralUsageDescription
        // We just need to request the state
        const state = await bleManagerRef.current?.state();
        setIsBluetoothEnabled(state === "PoweredOn");
        return state === "PoweredOn";
      } else if (Platform.OS === "android") {
        // Request necessary Android permissions
        const { status } = await Permissions.askAsync(
          Permissions.BLUETOOTH_SCAN,
          Permissions.BLUETOOTH_CONNECT
        );
        return status === "granted";
      }
      return true;
    } catch (error) {
      console.error("Error requesting Bluetooth permissions:", error);
      return false;
    }
  };

  const enableBluetooth = useCallback(async () => {
    try {
      const permissionGranted = await requestBluetoothPermissions();

      if (!permissionGranted) {
        Alert.alert(
          "Permission Denied",
          "Bluetooth permissions are required to play"
        );
        return false;
      }

      if (Platform.OS === "android") {
        // On Android, we can show the Bluetooth enable request
        if (bleManagerRef.current) {
          try {
            await bleManagerRef.current.enable();
            setIsBluetoothEnabled(true);
            return true;
          } catch (error) {
            // If enable fails, show user settings
            showBluetoothSettings();
            return false;
          }
        }
      } else if (Platform.OS === "ios") {
        // On iOS, we can't enable Bluetooth programmatically
        // Show a message directing user to settings
        Alert.alert(
          "Enable Bluetooth",
          "Please enable Bluetooth in your device settings to continue.",
          [
            {
              text: "Go to Settings",
              onPress: () => {
                Linking.openSettings();
              },
            },
            {
              text: "Cancel",
              onPress: () => {},
            },
          ]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error enabling Bluetooth:", error);
      return false;
    }
  }, []);

  const showBluetoothSettings = () => {
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else if (Platform.OS === "ios") {
      Linking.openSettings();
    }
  };

  return {
    isBluetoothEnabled,
    isChecking,
    enableBluetooth,
    showBluetoothSettings,
  };
}
