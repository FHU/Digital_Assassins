import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import { BleManager, State } from "react-native-ble-plx";

// Singleton BleManager instance - reused across the app
let globalBleManager: BleManager | null = null;

/**
 * Get or create the global BLE manager instance
 * Ensures only one BleManager is created
 */
export function getBleManager(): BleManager {
  if (!globalBleManager) {
    globalBleManager = new BleManager();
  }
  return globalBleManager;
}

/**
 * Destroy the global BLE manager (cleanup)
 */
export function destroyBleManager(): void {
  if (globalBleManager) {
    globalBleManager.destroy();
    globalBleManager = null;
  }
}

export function useBluetooth() {
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const stateSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    initBluetooth();
    return () => {
      if (stateSubscriptionRef.current) {
        stateSubscriptionRef.current.remove();
      }
    };
  }, []);

  const initBluetooth = async () => {
    try {
      const manager = getBleManager();
      // Subscribe to BLE state changes
      stateSubscriptionRef.current = manager.onStateChange(async (state) => {
        console.log("BLE State:", state);
        setIsBluetoothEnabled(state === State.PoweredOn);
      }, true); // true = emit current value immediately
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
        // The permission dialog appears when we first access BLE manager
        const manager = getBleManager();

        // This will trigger the permission prompt on first access
        const state = await manager.state();
        setIsBluetoothEnabled(state === "PoweredOn");

        if (state !== "PoweredOn") {
          // Bluetooth is not enabled, user needs to enable it in settings
          return false;
        }

        return true;
      } else if (Platform.OS === "android") {
        // Request necessary Android permissions
        // Android 12+ (API 31+) requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        const scanPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: "Bluetooth Scan Permission",
            message: "This app needs Bluetooth scan permission to find nearby devices",
            buttonPositive: "OK",
          }
        );

        const connectPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: "Bluetooth Connect Permission",
            message: "This app needs Bluetooth connect permission to connect to devices",
            buttonPositive: "OK",
          }
        );

        // Also request location permission which is needed for Bluetooth on some devices
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "This app needs location permission for Bluetooth functionality",
            buttonPositive: "OK",
          }
        );

        return (
          scanPermission === PermissionsAndroid.RESULTS.GRANTED &&
          connectPermission === PermissionsAndroid.RESULTS.GRANTED &&
          locationPermission === PermissionsAndroid.RESULTS.GRANTED
        );
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
        if (Platform.OS === "android") {
          Alert.alert(
            "Permission Denied",
            "Bluetooth permissions are required to play. Please grant permissions in settings.",
            [
              {
                text: "Open Settings",
                onPress: () => Linking.openSettings(),
              },
              {
                text: "Cancel",
                style: "cancel",
              },
            ]
          );
        } else if (Platform.OS === "ios") {
          // On iOS, if permission wasn't granted or Bluetooth is off
          Alert.alert(
            "Enable Bluetooth",
            "Please enable Bluetooth in your device settings to continue.",
            [
              {
                text: "Go to Settings",
                onPress: () => Linking.openSettings(),
              },
              {
                text: "Cancel",
                style: "cancel",
              },
            ]
          );
        }
        return false;
      }

      if (Platform.OS === "android") {
        // On Android, we can try to enable Bluetooth programmatically
        const manager = getBleManager();
        try {
          await manager.enable();
          setIsBluetoothEnabled(true);
          return true;
        } catch {
          // If enable fails, show user settings
          showBluetoothSettings();
          return false;
        }
      }

      // On iOS, if we got here, Bluetooth is already enabled
      return true;
    } catch (error) {
      console.error("Error enabling Bluetooth:", error);
      Alert.alert(
        "Error",
        "Failed to enable Bluetooth. Please try again."
      );
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
    requestBluetoothPermissions,
    getBleManager,
  };
}
