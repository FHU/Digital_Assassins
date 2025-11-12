// App.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import * as Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, RESULTS, check, openSettings, request } from 'react-native-permissions';

// ---------- CONFIG ----------
const BLE_SCAN_SERVICE_UUID = null; // null = scan for all; or use a specific UUID you control
const TX_POWER_DEFAULT = -59; // assumed tx power (calibrate in testing)
const ENV_FACTOR = 2; // 2 = open space, 3..4 indoor; tweak by testing
const KILL_RADIUS_METERS = 9.144; // 30 feet in meters
// ----------------------------

const manager = new BleManager();

function rssiToDistance(rssi: number, txPower = TX_POWER_DEFAULT, n = ENV_FACTOR) {
  // d = 10 ^ ((txPower - rssi) / (10 * n))
  const ratio = (txPower - rssi) / (10 * n);
  return Math.pow(10, ratio);
}

function haversineDistMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Record<string, {device: Device, distance?: number, rssi?: number}>>({});
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetIdRef = useRef<string | null>(null); // id of target to kill (set via game logic)

  useEffect(() => {
    // cleanup on unmount
    return () => {
      manager.destroy();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensurePermissions();
      if (ok) startBLEScan();
    })();
  }, []);

  async function ensurePermissions(): Promise<boolean> {
    // Bluetooth permission (iOS)
    // NOTE: some versions of react-native-permissions expose `BLUETOOTH` instead
    // of `BLUETOOTH_PERIPHERAL`. Use the library's available key for iOS.
    let btStatus = await check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL).catch(()=>RESULTS.DENIED);
    if (btStatus !== RESULTS.GRANTED) {
      btStatus = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL).catch(()=>RESULTS.DENIED);
    }
    // Location permission (when in use)
    let locStatus = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE).catch(()=>RESULTS.DENIED);
    if (locStatus !== RESULTS.GRANTED) {
      locStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE).catch(()=>RESULTS.DENIED);
    }

    if (btStatus !== RESULTS.GRANTED || locStatus !== RESULTS.GRANTED) {
      Alert.alert('Permissions required', 'Bluetooth and Location permissions are needed. Open settings?', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: ()=>openSettings()}
      ]);
      return false;
    }
    // start periodic GPS watch (optional)
    Geolocation.getCurrentPosition(
      pos => {
        setLocation({lat: pos.coords.latitude, lon: pos.coords.longitude});
      },
      err => console.warn('gps getCurrentPosition err', err),
      {enableHighAccuracy: true, timeout: 5000, maximumAge: 2000}
    );
    Geolocation.watchPosition(
      pos => {
        setLocation({lat: pos.coords.latitude, lon: pos.coords.longitude});
      },
      err => console.warn('gps watch err', err),
      {enableHighAccuracy: true, distanceFilter: 1, interval: 3000, fastestInterval: 1000}
    );
    return true;
  }

  function startBLEScan() {
    if (scanning) return;
    setScanning(true);
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        // Start scanning
        manager.startDeviceScan(
          BLE_SCAN_SERVICE_UUID ? [BLE_SCAN_SERVICE_UUID] : null,
          {allowDuplicates: true},
          (error, scannedDevice) => {
            if (error) {
              console.warn('scan error', error.message);
              return;
            }
            if (!scannedDevice) return;
            const id = scannedDevice.id;
            const rssi = scannedDevice.rssi ?? undefined;
            let dist: number | undefined;
            if (typeof rssi === 'number') {
              dist = rssiToDistance(rssi);
            }
            setNearbyDevices((prev: Record<string, {device: Device, distance?: number, rssi?: number}>) => {
              const next = {...prev};
              next[id] = {device: scannedDevice, distance: dist, rssi};
              return next;
            });
          }
        );
      }
    }, true);
    // You may want to stop scanning after X seconds; for demo, we continue
  }

  function stopBLEScan() {
    manager.stopDeviceScan();
    setScanning(false);
  }

  // Simple function that returns whether any nearby device meets kill condition:
  // either BLE-estimated distance < threshold OR GPS distance < threshold (if we know target coords).
  function isTargetWithinKillRadius(targetCoords?: {lat:number, lon:number}, targetBleId?: string) {
    // 1) BLE check
    if (targetBleId) {
      const entry = nearbyDevices[targetBleId];
      if (entry && typeof entry.distance === 'number' && entry.distance <= KILL_RADIUS_METERS) return true;
      // As backup, use RSSI threshold for ~9m; you may tune it, e.g. rssi > -75
      if (entry && entry.rssi && entry.rssi > -80) return true;
    }
    // 2) GPS check
    if (targetCoords && location) {
      const d = haversineDistMeters(location.lat, location.lon, targetCoords.lat, targetCoords.lon);
      return d <= KILL_RADIUS_METERS;
    }
    // 3) If no info, return false
    return false;
  }

  // Example kill handler
  function onKillAttemptPressStart() {
    // start a press timer (e.g. must hold for 1.5s)
    pressTimer.current = setTimeout(() => {
      // on hold complete
      // In a real game you'd look up who the target is (e.g. via selected player) and then check proximity
      const targetBleId = targetIdRef.current ?? Object.keys(nearbyDevices)[0]; // sample: pick first nearby device
      const targetCoords = undefined; // if your game shares GPS to server you could use server-provided coords to check here
      if (isTargetWithinKillRadius(targetCoords, targetBleId)) {
        onKillSuccess(targetBleId);
      } else {
        Alert.alert('Too far', 'No enemy within 30 feet.');
      }
    }, 1500); // require 1.5s hold
  }
  function onKillAttemptPressEnd() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function onKillSuccess(targetBleId?: string|null) {
    // Game logic: locally mark them dead / update server
    Alert.alert('Kill!', `You killed ${targetBleId ?? 'enemy'}`);
    // TODO: notify server or emit local game event
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Digital Assassins — Demo</Text>
      <View style={styles.info}>
        <Text>BLE scanning: {scanning ? 'ON' : 'OFF'}</Text>
        <Text>Nearby devices: {Object.keys(nearbyDevices).length}</Text>
        <Text>Location: {location ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : 'unknown'}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={onKillAttemptPressStart}
        onPressOut={onKillAttemptPressEnd}
        style={styles.killButton}
      >
        <Text style={styles.killText}>PRESS & HOLD TO KILL</Text>
      </TouchableOpacity>

      <View style={{marginTop:20}}>
        <Text style={{fontSize:12, color:'#666'}}>Notes: BLE distance is estimated from RSSI and noisy. Use calibration & server-based checks for reliability.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1, alignItems:'center', padding:20},
  title:{fontSize:20, fontWeight:'700', marginVertical:10},
  info:{width:'100%', marginVertical:10},
  killButton:{backgroundColor:'#b22222', paddingVertical:20, paddingHorizontal:30, borderRadius:10},
  killText:{color:'#fff', fontWeight:'700'}
});
