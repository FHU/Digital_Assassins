import { useThemeColor } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

// ---------- CONFIG ----------
const BLE_SCAN_SERVICE_UUID = null; // null = scan for all devices
const TX_POWER_DEFAULT = -59; // assumed tx power at 1 meter (calibrate in testing)
const ENV_FACTOR = 2; // 2 = open space, 3-4 = indoor (tune based on environment)
const KILL_RADIUS_METERS = 9.144; // 30 feet in meters
const PRESS_HOLD_DURATION = 1500; // milliseconds to hold for kill
const DEVICE_TIMEOUT = 5000; // consider device gone if not seen in 5 seconds
// ----------------------------

const manager = new BleManager();

/**
 * Calculate estimated distance from RSSI using path loss formula
 * d = 10 ^ ((txPower - rssi) / (10 * n))
 */
function rssiToDistance(rssi: number, txPower = TX_POWER_DEFAULT, n = ENV_FACTOR): number {
  const ratio = (txPower - rssi) / (10 * n);
  return Math.pow(10, ratio);
}

interface DeviceInfo {
  device: Device;
  distance?: number;
  rssi?: number;
  lastSeen: number;
}

export default function BLEScanning() {
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Record<string, DeviceInfo>>({});
  const [isPressed, setIsPressed] = useState(false);
  const [targetInRange, setTargetInRange] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressProgress = useRef(new Animated.Value(0)).current;
  const targetIdRef = useRef<string | null>(null); // would be set from game state/server

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const dangerColor = useThemeColor({}, 'danger');

  // Initialize BLE manager
  useEffect(() => {
    const startScan = () => {
      if (scanning) return;
      setScanning(true);

      manager.startDeviceScan(
        BLE_SCAN_SERVICE_UUID ? [BLE_SCAN_SERVICE_UUID] : null,
        { allowDuplicates: true },
        (error, scannedDevice) => {
          if (error) {
            console.warn('BLE scan error:', error.message);
            return;
          }

          if (!scannedDevice) return;

          const id = scannedDevice.id;
          const rssi = scannedDevice.rssi ?? undefined;
          const distance = typeof rssi === 'number' ? rssiToDistance(rssi) : undefined;

          setNearbyDevices((prev) => ({
            ...prev,
            [id]: {
              device: scannedDevice,
              distance,
              rssi,
              lastSeen: Date.now(),
            },
          }));
        }
      );
    };

    const subscription = manager.onStateChange((state) => {
      setBleState(state);
      if (state === State.PoweredOn) {
        startScan();
      }
    }, true);

    return () => {
      subscription.remove();
      manager.stopDeviceScan();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up stale devices
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNearbyDevices((prev) => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach((id) => {
          if (now - updated[id].lastSeen > DEVICE_TIMEOUT) {
            delete updated[id];
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if target is in range (continuous check)
  useEffect(() => {
    const checkInRange = (): boolean => {
      const devices = Object.values(nearbyDevices);
      if (devices.length === 0) return false;

      if (targetIdRef.current) {
        const target = nearbyDevices[targetIdRef.current];
        if (!target) return false;
        return typeof target.distance === 'number' && target.distance <= KILL_RADIUS_METERS;
      }

      return devices.some(
        (device) => typeof device.distance === 'number' && device.distance <= KILL_RADIUS_METERS
      );
    };

    const cancel = () => {
      setIsPressed(false);

      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }

      Animated.timing(pressProgress, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    };

    const checkInterval = setInterval(() => {
      const inRange = checkInRange();
      setTargetInRange(inRange);

      if (isPressed && !inRange) {
        cancel();
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [nearbyDevices, isPressed, pressProgress]);

  function startBLEScan() {
    if (scanning) return;

    if (bleState !== 'PoweredOn') {
      Alert.alert(
        'Bluetooth Required',
        'Please enable Bluetooth to play the game.',
        [{ text: 'OK' }]
      );
      return;
    }

    setScanning(true);

    manager.startDeviceScan(
      BLE_SCAN_SERVICE_UUID ? [BLE_SCAN_SERVICE_UUID] : null,
      { allowDuplicates: true },
      (error, scannedDevice) => {
        if (error) {
          console.warn('BLE scan error:', error.message);
          return;
        }

        if (!scannedDevice) return;

        const id = scannedDevice.id;
        const rssi = scannedDevice.rssi ?? undefined;
        const distance = typeof rssi === 'number' ? rssiToDistance(rssi) : undefined;

        setNearbyDevices((prev) => ({
          ...prev,
          [id]: {
            device: scannedDevice,
            distance,
            rssi,
            lastSeen: Date.now(),
          },
        }));
      }
    );
  }

  function stopBLEScan() {
    manager.stopDeviceScan();
    setScanning(false);
  }

  function onKillAttemptPressStart() {
    if (!targetInRange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate progress bar
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: PRESS_HOLD_DURATION,
      useNativeDriver: false,
    }).start();

    // Start hold timer
    pressTimer.current = setTimeout(() => {
      onKillSuccess();
    }, PRESS_HOLD_DURATION);
  }

  function onKillAttemptPressEnd() {
    setIsPressed(false);

    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    // Reset progress animation
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }

  function onKillSuccess() {
    setIsPressed(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset animation
    pressProgress.setValue(0);

    // Find the target device
    const targetId = targetIdRef.current ?? Object.keys(nearbyDevices)[0];
    const targetDevice = nearbyDevices[targetId];
    const deviceName = targetDevice?.device.name || targetDevice?.device.id || 'enemy';

    Alert.alert(
      'Kill Successful!',
      `You eliminated ${deviceName}`,
      [
        {
          text: 'OK',
          onPress: () => {
            // TODO: Send kill event to server
            // TODO: Update game state
          },
        },
      ]
    );
  }

  // Calculate nearby devices within range
  const devicesInRange = Object.values(nearbyDevices).filter(
    (device) => typeof device.distance === 'number' && device.distance <= KILL_RADIUS_METERS
  );

  const closestDevice = Object.values(nearbyDevices).reduce<DeviceInfo | null>((closest, device) => {
    if (typeof device.distance !== 'number') return closest;
    if (!closest || (typeof closest.distance === 'number' && device.distance < closest.distance)) {
      return device;
    }
    return closest;
  }, null);

  // Progress bar width
  const progressWidth = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Digital Assassins</Text>
        <Text style={[styles.subtitle, { color: textColor }]}>Hunt Mode</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Bluetooth:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: bleState === 'PoweredOn' ? primaryColor : dangerColor },
            ]}
          >
            {bleState}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Scanning:</Text>
          <Text style={[styles.statusValue, { color: scanning ? primaryColor : textColor }]}>
            {scanning ? 'Active' : 'Inactive'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>Devices Nearby:</Text>
          <Text style={[styles.statusValue, { color: textColor }]}>
            {Object.keys(nearbyDevices).length}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: textColor }]}>In Range:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: devicesInRange.length > 0 ? primaryColor : textColor },
            ]}
          >
            {devicesInRange.length}
          </Text>
        </View>

        {closestDevice && (
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: textColor }]}>Closest Target:</Text>
            <Text style={[styles.statusValue, { color: textColor }]}>
              {closestDevice.distance?.toFixed(1)}m
            </Text>
          </View>
        )}
      </View>

      <View style={styles.attackContainer}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onKillAttemptPressStart}
          onPressOut={onKillAttemptPressEnd}
          disabled={!targetInRange}
          style={[
            styles.killButton,
            {
              backgroundColor: targetInRange ? dangerColor : '#666',
              opacity: isPressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={styles.killText}>
            {!targetInRange ? 'OUT OF RANGE' : isPressed ? 'ATTACKING...' : 'PRESS & HOLD TO ATTACK'}
          </Text>
        </TouchableOpacity>

        {isPressed && (
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: dangerColor,
                  width: progressWidth,
                },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, { color: textColor }]}>
          {targetInRange
            ? `Target in range! Hold button for ${PRESS_HOLD_DURATION / 1000}s to eliminate.`
            : 'Move within 30 feet of your target to attack.'}
        </Text>
        <Text style={[styles.noteText, { color: textColor }]}>
          Note: Distance is estimated from Bluetooth signal strength and may vary based on
          obstacles and interference.
        </Text>
      </View>

      {!scanning && bleState === 'PoweredOn' && (
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: primaryColor }]}
          onPress={startBLEScan}
        >
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        </TouchableOpacity>
      )}

      {scanning && (
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: '#666' }]}
          onPress={stopBLEScan}
        >
          <Text style={styles.scanButtonText}>Stop Scanning</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 5,
    opacity: 0.7,
  },
  statusContainer: {
    marginBottom: 30,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  attackContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  killButton: {
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 15,
    minWidth: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  killText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 4,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  infoContainer: {
    paddingHorizontal: 10,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    fontStyle: 'italic',
  },
  scanButton: {
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
