/**
 * useDeviceId - Get a unique device identifier
 *
 * Uses Device API to generate a consistent device ID
 * The ID is generated from device model and OS info
 */

import * as Device from 'expo-device';

/**
 * Generate a unique device ID using device info
 * This is a synchronous function that can be called from anywhere
 */
export function generateDeviceId(): string {
  // Use device-specific identifiers to create a unique ID
  const modelId = Device.modelId || Device.deviceName || 'unknown';
  const osVersion = Device.osVersion || 'unknown';

  // Create a reproducible hash-like string from device info
  // This won't be truly unique but will be consistent per device
  return `device-${modelId}-${osVersion}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Hook to get device ID (can be used in components)
 */
export function useDeviceId(): string {
  return generateDeviceId();
}

export default useDeviceId;
