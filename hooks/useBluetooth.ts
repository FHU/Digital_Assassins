import { BleManager } from "react-native-ble-plx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Linking, Alert, PermissionsAndroid } from "react-native";

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
        // The permission dialog appears when we first access BLE manager
        if (!bleManagerRef.current) {
          bleManagerRef.current = new BleManager();
        }

        // This will trigger the permission prompt on first access
        const state = await bleManagerRef.current.state();
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
        if (bleManagerRef.current) {
          try {
            await bleManagerRef.current.enable();
            setIsBluetoothEnabled(true);
            return true;
          } catch {
            // If enable fails, show user settings
            showBluetoothSettings();
            return false;
          }
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
  };
}
