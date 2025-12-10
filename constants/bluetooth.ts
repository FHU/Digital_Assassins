/**
 * Bluetooth configuration for Digital Assassins
 * These UUIDs identify game devices during BLE scanning and advertising
 */

// Custom service UUID - used to identify Digital Assassins game devices
// Generated with UUIDv4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
export const GAME_SERVICE_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Characteristic for player ID - allows devices to identify each other
export const PLAYER_ID_CHARACTERISTIC_UUID = '550e8400-e29b-41d4-a716-446655440001';

// Characteristic for username - optional display name
export const PLAYER_NAME_CHARACTERISTIC_UUID = '550e8400-e29b-41d4-a716-446655440002';

// Manufacturer ID for advertisement data (not required but good practice)
export const MANUFACTURER_ID = 0x004C; // Apple's ID (just for testing, change to unique ID later)

// BLE Advertisement configuration
export const BLE_ADVERTISEMENT_CONFIG = {
  // Use service UUID for filtering
  serviceUUIDs: [GAME_SERVICE_UUID],

  // Advertise with specific power to control range
  txPowerLevel: -12, // dBm (range roughly 10-30 meters depending on environment)
};

// Scanning configuration
export const BLE_SCAN_CONFIG = {
  // Only scan for our game devices
  serviceUUIDs: [GAME_SERVICE_UUID],

  // Allow duplicates so we get continuous RSSI updates
  allowDuplicates: true,
};

// RSSI to distance calculation constants
export const RSSI_CONFIG = {
  TX_POWER_AT_1M: -59, // Calibrate this based on testing
  ENV_FACTOR: 3, // 2 = open space, 3-4 = indoor, 4+ = obstructed
};

// Game mechanics constants
export const GAME_MECHANICS = {
  KILL_RADIUS_METERS: 9.144, // 30 feet
  DEVICE_TIMEOUT_MS: 2000, // Consider device gone if not seen for 2 seconds
  MAX_HEALTH_MS: 10000, // 10 seconds of health
  ASSASSINATE_HOLD_DURATION_MS: 2000, // 2 seconds to mark target
  DODGE_WINDOW_MS: 2000, // 2 seconds to dodge after being marked
};
