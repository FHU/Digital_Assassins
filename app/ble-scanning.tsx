import { useThemeColor } from '@/hooks/useThemeColor';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useBluetooth, getBleManager } from '@/hooks/useBluetooth';
import { useRouter } from 'expo-router';
import gameService from '@/services/gameService';
import supabaseLobbyStore, { supabase } from '@/services/SupabaseLobbyStore';
import { bleDeviceMapService } from '@/services/BleDeviceMapService';
import { attackSyncService } from '@/services/AttackSyncService';
import { GAME_SERVICE_UUID, GAME_MECHANICS, RSSI_CONFIG } from '@/constants/bluetooth';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Device, State } from 'react-native-ble-plx';

// Use constants from bluetooth config instead of local values
const TX_POWER_DEFAULT = RSSI_CONFIG.TX_POWER_AT_1M;
const ENV_FACTOR = RSSI_CONFIG.ENV_FACTOR;
const KILL_RADIUS_METERS = GAME_MECHANICS.KILL_RADIUS_METERS;
const DEVICE_TIMEOUT = GAME_MECHANICS.DEVICE_TIMEOUT_MS;
const MAX_HEALTH = GAME_MECHANICS.MAX_HEALTH_MS;
const ASSASSINATE_HOLD_DURATION = GAME_MECHANICS.ASSASSINATE_HOLD_DURATION_MS;
const DODGE_WINDOW = GAME_MECHANICS.DODGE_WINDOW_MS;

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
  const deviceId = useDeviceId();
  const router = useRouter();
  const { enableBluetooth, requestBluetoothPermissions } = useBluetooth();

  const [, setBleState] = useState<State>(State.Unknown);
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Record<string, DeviceInfo>>({});
  const [isPressed, setIsPressed] = useState(false);
  const [targetInRange, setTargetInRange] = useState(false); // Default to false - must be in range to attack

  // Game context
  const [lobbyId, setLobbyId] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [gameActive, setGameActive] = useState(true);

  // Demo mode for presentations (disables range check)
  const [demoMode, setDemoMode] = useState(false);

  // Health system
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH);
  const [opponentHealth, setOpponentHealth] = useState(MAX_HEALTH);

  // Dodge system
  const [isDodgePressed, setIsDodgePressed] = useState(false);
  const [beingAttacked, setBeingAttacked] = useState(false); // lights up dodge button (warning only)
  const [takingDamage, setTakingDamage] = useState(false); // actively taking damage

  // Assassinate system
  const [isAssassinatePressed, setIsAssassinatePressed] = useState(false);
  const [assassinateUnlocked, setAssassinateUnlocked] = useState(false);
  const [attackStartTime, setAttackStartTime] = useState<number | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressProgress = useRef(new Animated.Value(0)).current;
  // Note: targetIdRef removed - we now use bleDeviceMapService to look up target device IDs

  const dodgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assassinateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assassinateProgress = useRef(new Animated.Value(0)).current;

  // Real-time subscription for game end notification
  const gameEndSubscriptionRef = useRef<any>(null);
  const playerRemovalSubscriptionRef = useRef<any>(null);
  const attackStateSubscriptionRef = useRef<any>(null);

  // Animated sword icon for attack button
  const swordRotation = useRef(new Animated.Value(0)).current;
  const swordScale = useRef(new Animated.Value(1)).current;

  // Shield animation for successful dodge
  const shieldScale = useRef(new Animated.Value(0)).current;
  const shieldOpacity = useRef(new Animated.Value(0)).current;
  const [showShield, setShowShield] = useState(false);

  // Elimination animation
  const eliminationScale = useRef(new Animated.Value(0)).current;
  const eliminationOpacity = useRef(new Animated.Value(0)).current;
  const [showElimination, setShowElimination] = useState(false);
  const [eliminationType, setEliminationType] = useState<'victory' | 'death'>('victory');

  // Game countdown
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const countdownScale = useRef(new Animated.Value(0)).current;
  const countdownOpacity = useRef(new Animated.Value(0)).current;

  // Attack border glow animation
  const attackBorderOpacity = useRef(new Animated.Value(0)).current;

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const dangerColor = useThemeColor({}, 'danger');

  // Handle leaving the game
  const handleLeaveGame = async () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave the game?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Leave',
          onPress: async () => {
            try {
              // Stop BLE scanning
              const manager = getBleManager();
              await manager.stopDeviceScan();

              // Navigate back home
              router.replace('/');
            } catch (error) {
              console.error('Error leaving game:', error);
              Alert.alert('Error', 'Failed to leave game');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Initialize BLE manager
  useEffect(() => {
    let subscription: any = null;

    const startScan = async () => {
      if (scanning) return;
      setScanning(true);

      try {
        const manager = getBleManager();
        await manager.startDeviceScan(
          [GAME_SERVICE_UUID], // Only scan for our game devices
          { allowDuplicates: true }, // Allow duplicates for continuous RSSI updates
          (error: any, scannedDevice: Device | null) => {
            if (error) {
              console.warn('BLE scan error:', error.message);
              // Don't stop scanning on individual errors - just log them
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
      } catch (error: any) {
        console.error('Failed to start BLE scan:', error);
        setScanning(false);

        // Show user-friendly error message
        const errorMessage = error?.message || 'Unknown BLE error';
        if (errorMessage.includes('BluetoothOff') || errorMessage.includes('PoweredOff')) {
          Alert.alert('Bluetooth Off', 'Please enable Bluetooth to play the game');
        } else if (errorMessage.includes('permission')) {
          Alert.alert('Permission Denied', 'Please grant Bluetooth permissions in settings');
        } else {
          Alert.alert('BLE Error', `${errorMessage}\n\nMake sure Bluetooth is enabled.`);
        }
      }
    };

    const setupBLE = async () => {
      try {
        // Request permissions first
        const permissionsGranted = await requestBluetoothPermissions();
        if (!permissionsGranted) {
          Alert.alert('Permissions Required', 'Bluetooth permissions are required to play');
          return;
        }

        // Try to enable Bluetooth
        await enableBluetooth();

        const manager = getBleManager();
        subscription = manager.onStateChange(async (state: any) => {
          console.log('BLE State:', state);
          setBleState(state);

          if (state === State.PoweredOn) {
            await startScan();
          } else if (state === State.PoweredOff) {
            setScanning(false);
            try {
              await manager.stopDeviceScan();
            } catch (e) {
              // ignore
            }
            Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to continue playing');
          }
        }, true);
      } catch (error: any) {
        console.error('BLE setup error:', error);
        Alert.alert('BLE Error', 'Failed to initialize Bluetooth');
      }
    };

    setupBLE();

    return () => {
      try {
        if (subscription) {
          subscription.remove();
        }
        const manager = getBleManager();
        manager.stopDeviceScan().catch(() => {});
        // Don't destroy the manager - it's a singleton
      } catch (error) {
        console.error('Error cleaning up BLE:', error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableBluetooth, requestBluetoothPermissions]);

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

  // Initialize game context (lobby, player, target)
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Get current active lobby for this device
        // First try as host (hosted lobbies)
        let activeLobby = await supabaseLobbyStore.getCurrentActiveLobby(deviceId);

        // If not a host, find lobby by looking up player record
        if (!activeLobby) {
          console.log('Not a host, looking up lobby via player record...');

          // Find player record for this device
          const { data: playerRecord } = await supabase
            .from('player')
            .select('lobbyId')
            .eq('userId', deviceId)
            .order('lobbyId', { ascending: false })
            .limit(1)
            .single();

          if (playerRecord?.lobbyId) {
            // Got lobbyId from player record, fetch full lobby data
            const { data: lobbyData } = await supabase
              .from('lobby')
              .select('id, lobbyCode, lobbyName, createdAt')
              .eq('id', playerRecord.lobbyId)
              .in('status', ['waiting', 'started'])
              .single();

            if (lobbyData) {
              // Map the database fields to the expected format
              activeLobby = {
                id: lobbyData.id,
                code: lobbyData.lobbyCode,
                name: lobbyData.lobbyName,
                hostUsername: 'Host',
                players: [],
                createdAt: lobbyData.createdAt,
              };
              console.log(`✓ Found lobby via player record: ID=${activeLobby.id}`);
            }
          }
        }

        if (!activeLobby?.id) {
          console.error('No active lobby found');
          setTargetUsername('Error: No active lobby');
          return;
        }

        setLobbyId(activeLobby.id);

        // Get player record for this device in the lobby
        const { data: players, error: playerError } = await supabase
          .from('player')
          .select('id, username, targetId, healthRemaining, status, bledeviceid')
          .eq('lobbyId', activeLobby.id)
          .eq('userId', deviceId)
          .single();

        if (playerError) {
          console.error('Error fetching player record:', playerError);
          setTargetUsername('Error: Could not load player');
          return;
        }

        if (!players) {
          console.error('Player record not found');
          setTargetUsername('Error: Player not in lobby');
          return;
        }

        if (players) {
          setPlayerId(players.id);

          // Register this device's BLE ID in the device map
          if (players.bledeviceid) {
            bleDeviceMapService.registerDevice(players.bledeviceid, players.id, players.username);
          }

          // Fetch ALL players in the lobby to assign a target
          console.log(`[Lobby Query] Looking for players in lobbyId: ${activeLobby.id}`);

          const { data: allPlayers, error: allPlayersError } = await supabase
            .from('player')
            .select('id, username, bledeviceid, status, targetId')
            .eq('lobbyId', activeLobby.id);

          if (allPlayersError) {
            console.error('Error fetching all players:', allPlayersError);
            setTargetUsername('Error: Could not fetch players');
            return;
          }

          console.log(`[Lobby Query] Raw result: ${JSON.stringify(allPlayers)}`);

          if (!allPlayers || allPlayers.length === 0) {
            console.error('No players found in lobby');
            setTargetUsername('No players available');
            return;
          }

          console.log(`✓ Found ${allPlayers.length} players in lobby:`, allPlayers.map(p => `${p.username}(${p.id})`).join(', '));

          // Register all players in device map
          allPlayers.forEach((player) => {
            if (player.bledeviceid && player.status !== 'eliminated') {
              bleDeviceMapService.registerDevice(player.bledeviceid, player.id, player.username);
            }
          });

          // IMPORTANT: Always use the targetId from database (assigned by host at game start)
          if (!players.targetId) {
            console.error('ERROR: Player has no assigned target! Game may not have started properly.');
            console.error('Debug info:', { playerId: players.id, targetId: players.targetId, allPlayers: allPlayers.length });
            setTargetUsername('ERROR: No target assigned. Restart game.');
            return;
          }

          // Find the target player from the list
          const targetPlayer = allPlayers.find(p => p.id === players.targetId);
          
          if (!targetPlayer) {
            console.error('ERROR: Target player not found in lobby!');
            console.error('Debug info:', { targetId: players.targetId, availablePlayers: allPlayers.map(p => p.id) });
            setTargetUsername('ERROR: Target player not found.');
            return;
          }

          // Check if target is still alive
          if (targetPlayer.status === 'eliminated') {
            console.error('ERROR: Your target has been eliminated.');
            setTargetUsername('Target eliminated - game may be ending.');
            return;
          }

          console.log(`✓ Loaded assigned target: ${targetPlayer.username} (ID: ${targetPlayer.id})`);
          setTargetPlayerId(targetPlayer.id);
          setTargetUsername(targetPlayer.username);

          // Initialize health from database (default to MAX_HEALTH if not set, 0, or suspiciously low)
          // Treat values less than 1000ms as invalid and use MAX_HEALTH instead
          const playerHealthValue = (players.healthRemaining && players.healthRemaining >= 1000) ? players.healthRemaining : MAX_HEALTH;
          setPlayerHealth(playerHealthValue);
          setOpponentHealth(MAX_HEALTH);
        }

        console.log('✓ Game initialized:', { lobbyId: activeLobby.id, playerId: players?.id });
      } catch (error) {
        console.error('Error initializing game:', error);
      }
    };

    if (deviceId) {
      initializeGame();
    }
  }, [deviceId]);

  // Countdown effect - starts when both lobbyId and targetPlayerId are set
  useEffect(() => {
    // Only start countdown if game has loaded and player has a target
    if (!lobbyId || !targetPlayerId) return;

    // Set a small delay to let UI settle, then show countdown
    const countdownStartTimer = setTimeout(() => {
      console.log('🎮 Starting game countdown...');
      setShowCountdown(true);
      setCountdownValue(3);

      // Animate the first number
      animateCountdownNumber();
    }, 500);

    return () => clearTimeout(countdownStartTimer);
  }, [lobbyId, targetPlayerId]);

  // Countdown animation and tick logic
  const animateCountdownNumber = () => {
    let current = 3;

    const countdownTick = setInterval(() => {
      current--;

      if (current < 0) {
        // Countdown finished, hide it and start gameplay
        clearInterval(countdownTick);
        
        Animated.timing(countdownOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setShowCountdown(false);
          console.log('✅ Countdown finished - Game begins!');
        });
      } else {
        // Update the countdown value
        setCountdownValue(current);
        
        // Animate the number: scale in and fade
        countdownScale.setValue(0);
        countdownOpacity.setValue(1);
        
        Animated.sequence([
          Animated.spring(countdownScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.delay(current === 0 ? 300 : 700),
        ]).start();
      }
    }, 1000);
  }

  // Listen for game end notification from host
  useEffect(() => {
    if (!lobbyId) return;

    const subscribeToGameEnd = async () => {
      try {
        console.log('📡 Subscribing to game end notifications...');

        // Subscribe to lobby status changes using Supabase real-time
        gameEndSubscriptionRef.current = supabase
          .channel(`lobby-${lobbyId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'lobby',
              filter: `id=eq.${lobbyId}`,
            },
            (payload: any) => {
              console.log("[Game Update]", payload);

              // Check if game has ended
              if (payload.new.status === "ended") {
                console.log("🛑 Host has ended the game!");
                onGameEnded();
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error subscribing to game end:", error);
      }
    };

    subscribeToGameEnd();

    return () => {
      if (gameEndSubscriptionRef.current) {
        gameEndSubscriptionRef.current.unsubscribe();
      }
    };
  }, [lobbyId, router]);

  /**
   * Called when the host ends the game
   * Notifies the player and kicks them out
   */
  const onGameEnded = () => {
    setGameActive(false);

    Alert.alert(
      "Game Ended",
      "The host has ended the game.",
      [
        {
          text: "OK",
          onPress: () => {
            // Go back to home
            router.replace("/");
          },
        },
      ],
      { cancelable: false }
    );
  };

  /**
   * Called when the player is removed from the lobby by the host
   * Kicks the player out of the game immediately
   */
  const onPlayerRemoved = () => {
    setGameActive(false);

    Alert.alert(
      "Removed from Game",
      "The host removed you from the game.",
      [
        {
          text: "OK",
          onPress: () => {
            // Go back to home
            router.replace("/");
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Listen for player removal
  useEffect(() => {
    if (!playerId) return;

    const subscribeToPlayerRemoval = async () => {
      try {
        console.log("📡 Subscribing to player removal notifications...");

        playerRemovalSubscriptionRef.current = supabase
          .channel(`player-removal-game-${playerId}`)
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "player",
              filter: `id=eq.${playerId}`,
            },
            () => {
              console.log("⚠️ You were removed from the game!");
              onPlayerRemoved();
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error subscribing to player removal:", error);
      }
    };

    subscribeToPlayerRemoval();

    return () => {
      if (playerRemovalSubscriptionRef.current) {
        playerRemovalSubscriptionRef.current.unsubscribe();
      }
    };
  }, [playerId]);

  // Listen for attack state changes (being marked/attacked)
  useEffect(() => {
    if (!playerId) return;

    const subscribeToAttackState = async () => {
      try {
        console.log("📡 Subscribing to attack state changes...");

        attackStateSubscriptionRef.current = supabase
          .channel(`attack-state-${playerId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "player",
              filter: `id=eq.${playerId}`,
            },
            (payload: any) => {
              console.log("[Attack State Update]", payload);

              // Check if being attacked
              const newData = payload.new;
              if (newData.beingAttackedBy) {
                console.log(`⚠️ Being attacked by player ${newData.beingAttackedBy}`);

                // Show attack warning
                if (newData.markedAt && !newData.attackStartedAt) {
                  // Just marked, not actively attacking yet
                  setBeingAttacked(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                } else if (newData.attackStartedAt) {
                  // Actively being attacked!
                  setBeingAttacked(true);
                  setTakingDamage(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
              } else {
                // Attack ended or dodged
                setBeingAttacked(false);
                setTakingDamage(false);
              }

              // Update health if it changed
              if (newData.healthRemaining !== undefined) {
                setPlayerHealth(newData.healthRemaining);
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error subscribing to attack state:", error);
      }
    };

    subscribeToAttackState();

    return () => {
      if (attackStateSubscriptionRef.current) {
        attackStateSubscriptionRef.current.unsubscribe();
      }
    };
  }, [playerId]);

  // Poll for elimination status (check every 1 second if player has been eliminated)
  useEffect(() => {
    if (!playerId || !lobbyId) return;

    const eliminationCheckInterval = setInterval(async () => {
      try {
        const { data: playerStatus } = await supabase
          .from('player')
          .select('status')
          .eq('id', playerId)
          .single();

        // If player status is eliminated, show death screen and kick out
        if (playerStatus?.status === 'eliminated') {
          setGameActive(false);
          setEliminationType('death');
          setShowElimination(true);
          eliminationScale.setValue(0);
          eliminationOpacity.setValue(1);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

          Animated.sequence([
            // Burst in
            Animated.spring(eliminationScale, {
              toValue: 1,
              tension: 40,
              friction: 8,
              useNativeDriver: true,
            }),
            // Hold
            Animated.delay(2000),
            // Fade out
            Animated.timing(eliminationOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Kick player back to home
            setTimeout(() => {
              router.replace('/');
            }, 500);
          });

          // Stop checking once eliminated
          clearInterval(eliminationCheckInterval);
        }
      } catch (error) {
        console.error('Error checking elimination status:', error);
      }
    }, 1000);

    return () => clearInterval(eliminationCheckInterval);
  }, [playerId, lobbyId, router, eliminationScale, eliminationOpacity]);

  // Check if target is in range (continuous check)
  useEffect(() => {
    const checkInRange = (): boolean => {
      // If we don't have a target yet, nothing is in range
      if (!targetPlayerId) {
        return false;
      }

      // Look up the BLE device ID for our target player
      const targetBleDeviceId = bleDeviceMapService.getDeviceIdFromPlayer(targetPlayerId);

      if (!targetBleDeviceId) {
        // Target device not discovered yet
        return false;
      }

      // Check if that device is nearby and in range
      const targetDevice = nearbyDevices[targetBleDeviceId];
      if (!targetDevice) {
        return false;
      }

      const inRange = typeof targetDevice.distance === 'number' &&
                      targetDevice.distance <= KILL_RADIUS_METERS;

      if (inRange) {
        console.log(`✓ Target ${targetUsername} is in range (${targetDevice.distance?.toFixed(1)}m)`);
      }

      return inRange;
    };

    const checkInterval = setInterval(() => {
      const inRange = checkInRange();

      // Debug logging
      const deviceCount = Object.values(nearbyDevices).length;
      const devicesWithDistance = Object.values(nearbyDevices).filter(d => d.distance).length;
      const targetBleId = targetPlayerId ? bleDeviceMapService.getDeviceIdFromPlayer(targetPlayerId) : null;
      const targetInNearby = targetBleId ? nearbyDevices[targetBleId] : null;

      console.log(
        `[Range Check] Devices: ${deviceCount}, With Distance: ${devicesWithDistance}, ` +
        `Target: ${targetUsername ?? 'unknown'} (${targetBleId?.substring(0, 8) ?? 'not found'}...), ` +
        `Distance: ${targetInNearby?.distance?.toFixed(1) ?? 'unknown'}m, In Range: ${inRange}`
      );

      setTargetInRange(inRange);

      // Cancel ongoing attack if target goes out of range
      if (isPressed && !inRange) {
        console.log('[Range Check] Cancelling attack - target out of range');
        setIsPressed(false);
        setAttackStartTime(null);

        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }

        Animated.timing(pressProgress, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    }, 200); // Check more frequently (200ms)

    return () => clearInterval(checkInterval);
  }, [nearbyDevices, isPressed, pressProgress, targetPlayerId, targetUsername]);

  // Animate glowing border when being attacked or marked
  useEffect(() => {
    if (beingAttacked || takingDamage) {
      // Pulsing glow animation (1.5x faster: 500ms / 1.5 = ~333ms)
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(attackBorderOpacity, {
            toValue: 1,
            duration: 333,
            useNativeDriver: false,
          }),
          Animated.timing(attackBorderOpacity, {
            toValue: 0.5,
            duration: 333,
            useNativeDriver: false,
          }),
        ])
      );

      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
        attackBorderOpacity.setValue(0);
      };
    } else {
      attackBorderOpacity.setValue(0);
    }
  }, [beingAttacked, takingDamage, attackBorderOpacity]);

  // Take damage over time when actively being attacked (not just marked)
  useEffect(() => {
    if (takingDamage) {
      // Take damage over time while being attacked (1s of damage per second)
      const damageInterval = setInterval(() => {
        setPlayerHealth((prev) => {
          const newHealth = Math.max(0, prev - 1000); // 1 second of damage per interval
          if (newHealth === 0) {
            setTakingDamage(false);
            setBeingAttacked(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Show death elimination animation (skull)
            setEliminationType('death');
            setShowElimination(true);
            eliminationScale.setValue(0);
            eliminationOpacity.setValue(1);

            Animated.sequence([
              // Burst in
              Animated.spring(eliminationScale, {
                toValue: 1,
                tension: 40,
                friction: 8,
                useNativeDriver: true,
              }),
              // Hold
              Animated.delay(1500),
              // Fade out
              Animated.timing(eliminationOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setShowElimination(false);
            });
          }
          return newHealth;
        });
      }, 1000); // Apply damage every second

      return () => {
        clearInterval(damageInterval);
      };
    }
  }, [takingDamage, eliminationScale, eliminationOpacity]);

  // Animate swords when attack is unlocked
  useEffect(() => {
    if (assassinateUnlocked && (targetInRange || demoMode)) {
      // Pulsing scale animation
      const scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(swordScale, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(swordScale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );

      // Rotating animation (subtle swing back and forth)
      const rotateAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(swordRotation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(swordRotation, {
            toValue: -1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(swordRotation, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );

      scaleAnimation.start();
      rotateAnimation.start();

      return () => {
        scaleAnimation.stop();
        rotateAnimation.stop();
        swordScale.setValue(1);
        swordRotation.setValue(0);
      };
    } else {
      // Reset animations when not unlocked
      swordScale.setValue(1);
      swordRotation.setValue(0);
    }
  }, [assassinateUnlocked, targetInRange, demoMode, swordScale, swordRotation]);

  // Dodge button handlers - only for defending
  function onDodgePressStart() {
    if (!beingAttacked) {
      // Can only dodge when being attacked
      return;
    }

    setIsDodgePressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Successfully dodged! Cancel incoming attack
    setBeingAttacked(false);
    setTakingDamage(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Broadcast dodge event (clear attack state in database)
    if (playerId && lobbyId) {
      attackSyncService.broadcastDodged(0, playerId, lobbyId); // attackerId is 0 since we don't track it here
    }

    // Show shield animation
    setShowShield(true);
    shieldScale.setValue(0);
    shieldOpacity.setValue(1);

    // Animate shield: pop in, hold, then fade out
    Animated.sequence([
      // Pop in
      Animated.spring(shieldScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Hold for a moment
      Animated.delay(800),
      // Fade out
      Animated.parallel([
        Animated.timing(shieldOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(shieldScale, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowShield(false);
    });

    // TODO: Send dodge event to server/attacker
    // This should notify the attacker that their attack was dodged
    // The attacker will need to restart by marking target again

    //Alert.alert('Dodged!', 'You successfully dodged the attack!', [{ text: 'OK' }]);
  }

  function onDodgePressEnd() {
    setIsDodgePressed(false);
  }

  // Function to handle when opponent dodges (called from server/network)
  function onOpponentDodged() {
    // Reset attacker's state - they must restart the assassination process
    setAssassinateUnlocked(false);
    setIsPressed(false);
    setAttackStartTime(null);

    // Stop any ongoing attack
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    // Reset animations
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Target Dodged!',
      'Your target dodged the attack! You must mark them again to restart.',
      [{ text: 'OK' }]
    );
  }

  // Assassinate button handlers - hold for 2s to unlock attack button
  function onAssassinatePressStart() {
    if (!targetInRange && !demoMode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsAssassinatePressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate assassinate progress bar
    Animated.timing(assassinateProgress, {
      toValue: 1,
      duration: ASSASSINATE_HOLD_DURATION, // 2 seconds to unlock attack
      useNativeDriver: false,
    }).start();

    // Start assassinate timer - after 2 seconds, unlock attack button
    assassinateTimer.current = setTimeout(async () => {
      setAssassinateUnlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Broadcast "marked" event to target
      if (targetPlayerId && lobbyId) {
        await attackSyncService.broadcastMarked(playerId!, targetPlayerId, lobbyId);
      }
    }, ASSASSINATE_HOLD_DURATION);
  }

  function onAssassinatePressEnd() {
    setIsAssassinatePressed(false);

    if (assassinateTimer.current) {
      clearTimeout(assassinateTimer.current);
      assassinateTimer.current = null;
    }

    // Stop and reset assassinate progress animation immediately
    assassinateProgress.stopAnimation();
    assassinateProgress.setValue(0);
  }

  // Attack button handlers - deals damage over time (only works if assassinate was held first)
  function onKillAttemptPressStart() {
    // Validate all preconditions before allowing attack
    if (!playerId || !targetPlayerId || !lobbyId) {
      console.error('Cannot attack: missing game context', { playerId, targetPlayerId, lobbyId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!targetInRange && !demoMode) {
      console.warn('Target out of range');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!assassinateUnlocked) {
      console.warn('Must mark target first (hold MARK TARGET for 2 seconds)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Prevent attacking if opponent is already dead
    if (opponentHealth <= 0) {
      console.warn('Target already eliminated');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // All checks passed - allow attack
    setIsPressed(true);
    setAttackStartTime(Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    console.log('⚔️ Attack started');

    // Broadcast "attacking" event to target
    if (targetPlayerId && lobbyId && playerId) {
      attackSyncService.broadcastAttacking(playerId, targetPlayerId, lobbyId);
    }

    // Animate attack progress - duration based on opponent's REMAINING health
    // Duration equals opponent's current health in milliseconds (min 500ms)
    const animationDuration = Math.max(500, opponentHealth);
    console.log(`Attack animation duration: ${animationDuration}ms for remaining health: ${opponentHealth}ms`);
    
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: animationDuration,
      useNativeDriver: false,
    }).start();
  }

  async function onKillAttemptPressEnd() {
    // Only process if attack actually started
    if (!isPressed || attackStartTime === null || !playerId || !targetPlayerId || !lobbyId) {
      console.log('Attack end: skipping (attack not started properly)');
      setIsPressed(false);
      return;
    }

    // Calculate damage dealt (time held in milliseconds)
    const attackEndTime = Date.now();
    const damageDealt = attackEndTime - attackStartTime;

    try {
      // Apply damage through game service
      const damageResult = await gameService.damagePlayer(targetPlayerId, damageDealt, playerId);

      // Update opponent health UI
      setOpponentHealth(Math.max(0, damageResult.healthRemaining));

      // Check if target was eliminated
      if (damageResult.eliminated && damageResult.eliminationData) {
        console.log('✓ Target eliminated!', damageResult.eliminationData);

        // Stop the animation immediately
        pressProgress.stopAnimation();
        pressProgress.setValue(0);
        
        // Release the attack button immediately so player sees it unpressed
        setIsPressed(false);
        setAttackStartTime(null);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Wait a brief moment for UI to update, then show victory elimination animation (dagger)
        setTimeout(() => {
          setEliminationType('victory');
          setShowElimination(true);
          eliminationScale.setValue(0);
          eliminationOpacity.setValue(1);

          Animated.sequence([
            // Burst in
            Animated.spring(eliminationScale, {
              toValue: 1,
              tension: 40,
              friction: 8,
              useNativeDriver: true,
            }),
            // Hold
            Animated.delay(1500),
            // Fade out
            Animated.timing(eliminationOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start(async () => {
            setShowElimination(false);

            // Update target to the eliminated player's target (from gameService)
            if (damageResult.eliminationData?.victim.targetId) {
              setTargetPlayerId(damageResult.eliminationData.victim.targetId);

              // Get new target info
              const { data: newTarget } = await supabase
                .from('player')
                .select('id, username')
                .eq('id', damageResult.eliminationData.victim.targetId)
                .single();

              if (newTarget) {
                setTargetUsername(newTarget.username);
              }
            }

            // Check if game should end
            const gameStats = await gameService.getLobbyStats(lobbyId);
            if (gameStats.alivePlayers === 1) {
              console.log('🎉 Game Over! You are the last player standing!');
              setGameActive(false);

              // Show victory message
              Alert.alert(
                '🎉 Victory!',
                'You are the last player standing!',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      // End the game and clean up data
                      console.log('🛑 Winner is ending the game...');
                      await gameService.endLobby(lobbyId);

                      // Navigate home
                      router.replace('/');
                    },
                  },
                ],
                { cancelable: false }
              );
            }
          });
        }, 100); // Brief 100ms delay before showing animation
      }
    } catch (error) {
      console.error('Error applying damage:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Reset attack state
    setIsPressed(false);
    setAttackStartTime(null);

    // Stop and reset progress animation immediately (only if not already reset by elimination)
    if (opponentHealth > 0) {
      pressProgress.stopAnimation();
      pressProgress.setValue(0);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // Progress bar width
  const progressWidth = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const assassinateProgressWidth = assassinateProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Monitor target health and stop attack if target dies or goes out of range
  useEffect(() => {
    if (!isPressed || !targetPlayerId) return;

    const checkTargetAlive = setInterval(() => {
      // Check if target is still in range
      const targetBleDeviceId = bleDeviceMapService.getDeviceIdFromPlayer(targetPlayerId);
      const targetDevice = targetBleDeviceId ? nearbyDevices[targetBleDeviceId] : null;
      const stillInRange = targetDevice && typeof targetDevice.distance === 'number' 
        ? targetDevice.distance <= KILL_RADIUS_METERS 
        : false;

      // If target is out of range or dead, stop the attack
      if (opponentHealth <= 0) {
        console.log('🛑 Target is dead - stopping attack');
        setIsPressed(false);
        pressProgress.stopAnimation();
        pressProgress.setValue(0);
        clearInterval(checkTargetAlive);
        return;
      }

      if (!demoMode && !stillInRange) {
        console.log('🛑 Target out of range - stopping attack');
        setIsPressed(false);
        pressProgress.stopAnimation();
        pressProgress.setValue(0);
        clearInterval(checkTargetAlive);
        return;
      }
    }, 100); // Check every 100ms for responsive feedback

    return () => clearInterval(checkTargetAlive);
  }, [isPressed, targetPlayerId, opponentHealth, nearbyDevices, demoMode]);

  // Sword animation interpolations
  const swordRotationDegrees = swordRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  // Calculate border color based on health (yellow -> orange -> red)
  const getBorderColor = () => {
    const healthPercent = (playerHealth / MAX_HEALTH) * 100;

    if (healthPercent > 66) {
      // High health: Yellow
      return '#FFD700';
    } else if (healthPercent > 33) {
      // Medium health: Orange
      return '#FF8C00';
    } else {
      // Low health: Red
      return '#FF0000';
    }
  };

  // Calculate health bar color based on percentage
  const getHealthBarColor = (healthPercent: number) => {
    if (healthPercent > 75) {
      return '#4CAF50'; // Green
    } else if (healthPercent > 50) {
      return '#FFD700'; // Yellow
    } else if (healthPercent > 25) {
      return '#FF8C00'; // Orange
    } else {
      return '#FF0000'; // Red
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          {/* Optional: Add logo image here */}
          {/* <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          /> */}
          <Text style={[styles.title, { color: textColor }]}>Digital Assassins</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Your Target Is: <Text style={{ fontWeight: 'bold', color: '#FF6B00' }}>{targetUsername ? targetUsername.toUpperCase() : 'LOADING...'}</Text>
          </Text>
          {targetPlayerId && (
            <Text style={[styles.debugText, { color: textColor }]}>
              (ID: {targetPlayerId})
            </Text>
          )}
        </View>

      {/* Health Bars Section */}
      <View style={styles.healthSection}>
        {/* Player Health */}
        <View style={styles.healthBarWrapper}>
          <Text style={[styles.healthLabel, { color: textColor }]}>Your Health</Text>
          <View style={styles.healthBarContainer}>
            <View
              style={[
                styles.healthBar,
                {
                  width: `${playerHealthPercent}%`,
                  backgroundColor: getHealthBarColor(playerHealthPercent),
                },
              ]}
            />
          </View>
          <Text style={[styles.healthText, { color: textColor }]}>
            {(playerHealth / 1000).toFixed(1)}s / {MAX_HEALTH / 1000}s
          </Text>
        </View>

        {/* Opponent Health */}
        <View style={styles.healthBarWrapper}>
          <Text style={[styles.healthLabel, { color: textColor }]}>Target Health</Text>
          <View style={styles.healthBarContainer}>
            <View
              style={[
                styles.healthBar,
                {
                  width: `${opponentHealthPercent}%`,
                  backgroundColor: getHealthBarColor(opponentHealthPercent),
                },
              ]}
            />
          </View>
          <Text style={[styles.healthText, { color: textColor }]}>
            {(opponentHealth / 1000).toFixed(1)}s / {MAX_HEALTH / 1000}s
          </Text>
        </View>
      </View>

      <View style={styles.attackContainer}>
        {/* Block Button (Top) - for defending */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onDodgePressStart}
          onPressOut={onDodgePressEnd}
          disabled={!beingAttacked}
          style={[
            styles.blockButton,
            {
              backgroundColor: beingAttacked ? '#007AFF' : '#555',
              opacity: isDodgePressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {beingAttacked ? '⚠️ BLOCK!' : 'BLOCK'}
          </Text>
        </TouchableOpacity>

        {/* Mark Target Button (Middle) */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onAssassinatePressStart}
          onPressOut={onAssassinatePressEnd}
          disabled={assassinateUnlocked || (!targetInRange && !demoMode)}
          style={[
            styles.markButton,
            {
              backgroundColor: assassinateUnlocked
                ? '#4CAF50'
                : (targetInRange || demoMode)
                ? '#FF6B00'
                : '#666',
              opacity: isAssassinatePressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {assassinateUnlocked
              ? '✓ MARKED'
              : !targetInRange && !demoMode
              ? 'OUT OF RANGE'
              : isAssassinatePressed
              ? 'MARKING...'
              : 'MARK TARGET'}
          </Text>
        </TouchableOpacity>

        {isAssassinatePressed && (
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: '#FF6B00',
                  width: assassinateProgressWidth,
                },
              ]}
            />
          </View>
        )}

        {/* Attack Button (Bottom) - deals damage */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onKillAttemptPressStart}
          onPressOut={onKillAttemptPressEnd}
          disabled={!assassinateUnlocked || (!targetInRange && !demoMode)}
          style={[
            styles.attackButton,
            {
              backgroundColor:
                assassinateUnlocked && (targetInRange || demoMode) ? dangerColor : '#666',
              opacity: isPressed ? 0.8 : 1,
            },
          ]}
        >
          {/* Animated Crossed Swords Icon */}
          {assassinateUnlocked && (targetInRange || demoMode) && (
            <Animated.Text
              style={[
                styles.swordIcon,
                {
                  transform: [
                    { rotate: swordRotationDegrees },
                    { scale: swordScale },
                  ],
                },
              ]}
            >
              ⚔️
            </Animated.Text>
          )}

          <Text style={styles.buttonText}>
            {!assassinateUnlocked
              ? 'MARK FIRST'
              : !targetInRange && !demoMode
              ? 'OUT OF RANGE'
              : isPressed
              ? 'ATTACKING...'
              : 'ATTACK'}
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
          {!assassinateUnlocked
            ? 'Hold MARK TARGET to prepare your attack'
            : !targetInRange
            ? 'Move closer to your target'
            : 'Hold ATTACK to deal damage'}
        </Text>

        {/* Demo Mode Button */}
        <TouchableOpacity
          style={[styles.demoButton, { backgroundColor: demoMode ? '#9C27B0' : '#666' }]}
          onPress={() => setDemoMode(!demoMode)}
        >
          <Text style={styles.demoButtonText}>{demoMode ? '✓ DEMO ON' : 'DEMO OFF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Leave Game Buttons */}
      <View style={styles.exitButtonContainer}>
        <TouchableOpacity
          style={[styles.exitButton, { backgroundColor: dangerColor }]}
          onPress={handleLeaveGame}
        >
          <Text style={styles.exitButtonText}>Leave Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exitButton, { backgroundColor: textColor + '40' }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.exitButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Attack Border Glow - appears when being attacked or marked */}
      {(beingAttacked || takingDamage) && (
        <Animated.View
          style={[
            styles.attackBorder,
            {
              borderColor: getBorderColor(),
              opacity: attackBorderOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Shield Animation Overlay - appears when dodge is successful */}
      {showShield && (
        <View style={styles.shieldOverlay}>
          <Animated.View
            style={[
              styles.shieldContainer,
              {
                transform: [{ scale: shieldScale }],
                opacity: shieldOpacity,
              },
            ]}
          >
            <Text style={styles.shieldIcon}>🛡️</Text>
            <Text style={styles.shieldText}>BLOCKED!</Text>
          </Animated.View>
        </View>
      )}

      {/* Elimination Animation Overlay - appears when opponent is eliminated */}
      {showElimination && (
        <View style={styles.eliminationOverlay}>
          <Animated.View
            style={[
              styles.eliminationContainer,
              {
                transform: [{ scale: eliminationScale }],
                opacity: eliminationOpacity,
              },
            ]}
          >
            {eliminationType === 'victory' ? (
              <>
                <Text style={styles.eliminationIcon}>🗡️</Text>
                <Text style={[styles.eliminationText, { color: '#FFD700' }]}>ELIMINATED!</Text>
              </>
            ) : (
              <>
                <Text style={styles.eliminationIcon}>💀</Text>
                <Text style={[styles.eliminationText, { color: '#FF0000' }]}>YOU DIED!</Text>
              </>
            )}
          </Animated.View>
        </View>
      )}

      {/* Countdown Overlay - appears when game starts */}
      {showCountdown && (
        <View style={styles.countdownOverlay}>
          <Animated.View
            style={[
              styles.countdownContainer,
              {
                transform: [{ scale: countdownScale }],
                opacity: countdownOpacity,
              },
            ]}
          >
            {countdownValue >= 0 ? (
              <>
                <Text style={styles.countdownNumber}>
                  {countdownValue === 0 ? 'GO!' : countdownValue}
                </Text>
              </>
            ) : (
              <Text style={styles.countdownBegin}>BEGIN!</Text>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 15,
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
  debugText: {
    fontSize: 12,
    marginTop: 5,
    opacity: 0.5,
    fontStyle: 'italic',
  },
  healthSection: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  healthBarWrapper: {
    marginVertical: 8,
  },
  healthLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  healthBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  healthBar: {
    height: '100%',
    borderRadius: 10,
  },
  healthText: {
    fontSize: 12,
    marginTop: 3,
    textAlign: 'right',
    opacity: 0.8,
  },
  statusContainer: {
    marginBottom: 20,
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
    marginVertical: 20,
  },
  blockButton: {
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 15,
    minWidth: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 10,
  },
  markButton: {
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 15,
    minWidth: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 10,
  },
  attackButton: {
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 15,
    minWidth: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'column',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  swordIcon: {
    fontSize: 40,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  infoContainer: {
    paddingHorizontal: 10,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 0,
  },
  demoButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  demoButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  attackBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 12,
    borderRadius: 0,
    zIndex: 999,
  },
  shieldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  shieldContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: {
    fontSize: 200,
    textAlign: 'center',
    marginBottom: 20,
  },
  shieldText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#007AFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 8,
  },
  eliminationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1001,
  },
  eliminationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliminationIcon: {
    fontSize: 180,
    textAlign: 'center',
    marginBottom: 20,
  },
  eliminationText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FF0000',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  exitButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  exitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1002,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 220,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 165, 0, 0.8)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 20,
    textAlign: 'center',
    marginTop: -40,
  },
  countdownBegin: {
    fontSize: 120,
    fontWeight: '900',
    color: '#00FF00',
    textShadowColor: 'rgba(0, 255, 0, 0.8)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 20,
    textAlign: 'center',
    letterSpacing: 4,
  },
});
