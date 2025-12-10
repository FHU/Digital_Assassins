/**
 * Service to manage mapping between BLE device IDs (MAC addresses) and game player IDs
 *
 * When players join a game lobby, we store the mapping of their BLE device ID
 * to their player ID. This allows us to identify players during scanning.
 */

interface DeviceMapping {
  bleDeviceId: string; // MAC address or device ID from BLE scan
  playerId: number;
  username: string;
  joinedAt: number; // timestamp
}

class BleDeviceMapService {
  private deviceMap: Map<string, DeviceMapping> = new Map();
  private playerIdMap: Map<number, DeviceMapping> = new Map();

  /**
   * Register a device when a player joins the lobby
   * Called when we scan a new device and learn its player ID from Supabase
   */
  registerDevice(bleDeviceId: string, playerId: number, username: string) {
    const mapping: DeviceMapping = {
      bleDeviceId,
      playerId,
      username,
      joinedAt: Date.now(),
    };

    this.deviceMap.set(bleDeviceId, mapping);
    this.playerIdMap.set(playerId, mapping);

    console.log(`✓ Registered device: BLE=${bleDeviceId} -> Player=${playerId} (${username})`);
  }

  /**
   * Get player ID from a BLE device ID
   */
  getPlayerIdFromDevice(bleDeviceId: string): number | null {
    return this.deviceMap.get(bleDeviceId)?.playerId ?? null;
  }

  /**
   * Get player info from a BLE device ID
   */
  getPlayerFromDevice(bleDeviceId: string): DeviceMapping | null {
    return this.deviceMap.get(bleDeviceId) ?? null;
  }

  /**
   * Get BLE device ID from player ID
   */
  getDeviceIdFromPlayer(playerId: number): string | null {
    return this.playerIdMap.get(playerId)?.bleDeviceId ?? null;
  }

  /**
   * Get player info from player ID
   */
  getPlayerInfo(playerId: number): DeviceMapping | null {
    return this.playerIdMap.get(playerId) ?? null;
  }

  /**
   * Check if we know about a BLE device
   */
  isDeviceRegistered(bleDeviceId: string): boolean {
    return this.deviceMap.has(bleDeviceId);
  }

  /**
   * Get all registered devices
   */
  getAllDevices(): DeviceMapping[] {
    return Array.from(this.deviceMap.values());
  }

  /**
   * Get all devices for a specific lobby (optional: if you track lobbies)
   */
  getDeviceCount(): number {
    return this.deviceMap.size;
  }

  /**
   * Remove a device from the map (when player leaves or is eliminated)
   */
  unregisterDevice(bleDeviceId: string): void {
    const mapping = this.deviceMap.get(bleDeviceId);
    if (mapping) {
      this.deviceMap.delete(bleDeviceId);
      this.playerIdMap.delete(mapping.playerId);
      console.log(`✓ Unregistered device: ${bleDeviceId}`);
    }
  }

  /**
   * Clear all mappings (when game ends or player leaves lobby)
   */
  clear(): void {
    this.deviceMap.clear();
    this.playerIdMap.clear();
    console.log('✓ Cleared all device mappings');
  }

  /**
   * Debug: print all mappings
   */
  debugPrint(): void {
    console.log('=== BLE Device Mappings ===');
    this.deviceMap.forEach((mapping) => {
      console.log(
        `  ${mapping.bleDeviceId.substring(0, 8)}... -> Player ${mapping.playerId} (${mapping.username})`
      );
    });
    console.log(`Total: ${this.deviceMap.size} devices`);
  }
}

// Export singleton instance
export const bleDeviceMapService = new BleDeviceMapService();
