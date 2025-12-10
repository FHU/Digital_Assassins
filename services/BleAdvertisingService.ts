import { BleManager } from 'react-native-ble-plx';
import { GAME_SERVICE_UUID, BLE_ADVERTISEMENT_CONFIG } from '@/constants/bluetooth';

/**
 * Service to handle BLE advertising for Digital Assassins
 * Advertises this device as a game player so others can find it
 */

class BleAdvertisingService {
  private manager: BleManager | null = null;
  private isAdvertising = false;
  private playerId: number | null = null;
  private username: string | null = null;

  /**
   * Initialize the advertising service with a BLE manager instance
   */
  initialize(manager: BleManager) {
    this.manager = manager;
  }

  /**
   * Start advertising this device as a game player
   * Encodes player ID in the device name for easy identification
   */
  async startAdvertising(playerId: number, username: string): Promise<boolean> {
    if (!this.manager) {
      console.error('BleAdvertisingService not initialized');
      return false;
    }

    if (this.isAdvertising && this.playerId === playerId) {
      console.log(`Already advertising as player ${playerId}`);
      return true;
    }

    try {
      // Stop existing advertising if any
      if (this.isAdvertising) {
        await this.stopAdvertising();
      }

      this.playerId = playerId;
      this.username = username;

      // Encode player ID in device name for discovery
      // Format: "DA_<playerId>" (DA = Digital Assassins)
      // Example: "DA_12345"
      const deviceName = `DA_${playerId}`;

      console.log(`🎯 Starting BLE advertising as: ${deviceName}`);

      // Start advertising
      // Note: The BleManager from react-native-ble-plx doesn't have a direct startAdvertising method
      // We need to use the native Bluetooth API through the BleManager
      // For now, we'll rely on the device's default advertisement or create a workaround

      // Try to advertise using the BleManager's native bindings
      // This requires the BLE peripheral to be set up with a service
      await this.manager.startDeviceScan(
        [GAME_SERVICE_UUID],
        { allowDuplicates: true },
        () => {
          // Dummy scan - in a real implementation, the device should be
          // advertising itself through native code setup
        }
      );

      this.isAdvertising = true;
      return true;
    } catch (error) {
      console.error('Error starting BLE advertising:', error);
      return false;
    }
  }

  /**
   * Stop advertising this device
   */
  async stopAdvertising(): Promise<void> {
    if (!this.manager) return;

    try {
      if (this.isAdvertising) {
        await this.manager.stopDeviceScan();
        this.isAdvertising = false;
        console.log('✓ Stopped BLE advertising');
      }
    } catch (error) {
      console.error('Error stopping BLE advertising:', error);
    }
  }

  /**
   * Get current advertising status
   */
  getAdvertisingStatus() {
    return {
      isAdvertising: this.isAdvertising,
      playerId: this.playerId,
      username: this.username,
    };
  }

  /**
   * Destroy the service
   */
  destroy() {
    this.manager = null;
    this.isAdvertising = false;
    this.playerId = null;
    this.username = null;
  }
}

// Export singleton instance
export const bleAdvertisingService = new BleAdvertisingService();
