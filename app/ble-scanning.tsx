import { useThemeColor } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

// ---------- CONFIG ----------
const BLE_SCAN_SERVICE_UUID = null; // null = scan for all devices
const TX_POWER_DEFAULT = -59; // assumed tx power at 1 meter (calibrate in testing)
const ENV_FACTOR = 3; // 2 = open space, 3-4 = indoor (tune based on environment)
const KILL_RADIUS_METERS = 9.144; // 30 feet in meters
const DEVICE_TIMEOUT = 2000; // consider device gone if not seen in 2 seconds
const MAX_HEALTH = 10000; // 10 seconds of health in milliseconds
const ASSASSINATE_HOLD_DURATION = 2000; // 2 seconds to mark target before attack unlocks
const DODGE_WINDOW = 2000; // 2 seconds to press dodge when being attacked (TODO: implement incoming attack detection)
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
  const [, setBleState] = useState<State>(State.Unknown);
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Record<string, DeviceInfo>>({});
  const [isPressed, setIsPressed] = useState(false);
  const [targetInRange, setTargetInRange] = useState(true); // Default to true for testing

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
  const targetIdRef = useRef<string | null>(null); // would be set from game state/server

  const dodgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assassinateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assassinateProgress = useRef(new Animated.Value(0)).current;

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

  // Attack border glow animation
  const attackBorderOpacity = useRef(new Animated.Value(0)).current;

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
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

    const checkInterval = setInterval(() => {
      const inRange = checkInRange();

      // Debug logging - remove in production
      const deviceCount = Object.values(nearbyDevices).length;
      const devicesWithDistance = Object.values(nearbyDevices).filter(d => d.distance).length;
      console.log(`[Range Check] Devices: ${deviceCount}, With Distance: ${devicesWithDistance}, In Range: ${inRange}`);

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
    }, 200); // Check more frequently (200ms instead of 500ms)

    return () => clearInterval(checkInterval);
  }, [nearbyDevices, isPressed, pressProgress]);

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
    if (assassinateUnlocked && targetInRange) {
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
  }, [assassinateUnlocked, targetInRange, swordScale, swordRotation]);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
    if (!targetInRange) {
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
    assassinateTimer.current = setTimeout(() => {
      setAssassinateUnlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (!targetInRange) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!assassinateUnlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Bug fix #3: Prevent attacking if opponent is already dead
    if (opponentHealth <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsPressed(true);
    setAttackStartTime(Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Animate attack progress - duration based on opponent's REMAINING health
    // Bug fix #3: Ensure minimum duration of 100ms to prevent animation issues
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: Math.max(100, opponentHealth), // Duration equals opponent's current health (min 100ms)
      useNativeDriver: false,
    }).start();
  }

  function onKillAttemptPressEnd() {
    if (!isPressed || attackStartTime === null) return;

    // Calculate damage dealt (time held in milliseconds)
    const attackEndTime = Date.now();
    const damageDealt = attackEndTime - attackStartTime;

    // Update opponent health (subtract damage, don't go below 0)
    setOpponentHealth((prevHealth) => {
      const newHealth = Math.max(0, prevHealth - damageDealt);

      // Bug fix #5: Stop progress bar animation immediately when target is eliminated
      if (newHealth === 0) {
        // Stop the animation immediately
        pressProgress.stopAnimation();
        pressProgress.setValue(0);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Show victory elimination animation (dagger)
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
        ]).start(() => {
          setShowElimination(false);
        });
      }

      return newHealth;
    });

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

  // Calculate health percentages for health bars
  const playerHealthPercent = (playerHealth / MAX_HEALTH) * 100;
  const opponentHealthPercent = (opponentHealth / MAX_HEALTH) * 100;

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
          <Text style={[styles.subtitle, { color: textColor }]}>Your Target Is: NIMA. FINISH HIM</Text>
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
        {/* Dodge Button (Top) */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onDodgePressStart}
          onPressOut={onDodgePressEnd}
          disabled={!beingAttacked}
          style={[
            styles.dodgeButton,
            {
              backgroundColor: beingAttacked ? '#007AFF' : '#555',
              opacity: isDodgePressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {beingAttacked ? '⚠️ DODGE NOW!' : 'DODGE (Defend Only)'}
          </Text>
        </TouchableOpacity>

        {/* Assassinate Button (Middle) */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onAssassinatePressStart}
          onPressOut={onAssassinatePressEnd}
          disabled={assassinateUnlocked || !targetInRange}
          style={[
            styles.assassinateButton,
            {
              backgroundColor: assassinateUnlocked
                ? '#4CAF50'
                : targetInRange
                ? '#FF6B00'
                : '#666',
              opacity: isAssassinatePressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {assassinateUnlocked
              ? '✓ TARGET MARKED'
              : !targetInRange
              ? 'OUT OF RANGE'
              : isAssassinatePressed
              ? 'MARKING TARGET...'
              : 'MARK TARGET (Hold 2s)'}
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
          disabled={!assassinateUnlocked || !targetInRange}
          style={[
            styles.killButton,
            {
              backgroundColor:
                assassinateUnlocked && targetInRange ? dangerColor : '#666',
              opacity: isPressed ? 0.8 : 1,
            },
          ]}
        >
          {/* Animated Crossed Swords Icon */}
          {assassinateUnlocked && targetInRange && (
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
              ? 'MARK TARGET FIRST'
              : !targetInRange
              ? 'OUT OF RANGE'
              : isPressed
              ? 'ATTACKING...'
              : 'ATTACK (Hold to Damage)'}
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
            ? 'Hold MARK TARGET for 2s to unlock ATTACK button'
            : !targetInRange
            ? 'Move within 30 feet of your target'
            : 'Hold ATTACK button to deal damage over time!'}
        </Text>
        <Text style={[styles.noteText, { color: textColor }]}>
          Attack: Hold MARK TARGET (2s) → Hold ATTACK to deal damage (time held = damage dealt).
          Defend: Press DODGE when attacked!
        </Text>
      </View>

      {/* TEST BUTTONS - Remove in production */}
      <View style={styles.testButtonContainer}>
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#FF6B00' }]}
          onPress={() => {
            // Simulate being marked (2 second window to dodge, NO damage)
            setBeingAttacked(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Automatically stop after 2 seconds if not dodged
            setTimeout(() => {
              setBeingAttacked(false);
            }, DODGE_WINDOW);
          }}
        >
          <Text style={styles.testButtonText}>Test: Being Marked</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: dangerColor }]}
          onPress={() => {
            // Simulate being attacked for 2 seconds (with damage)
            setTakingDamage(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Stop attack after 2 seconds
            setTimeout(() => {
              setTakingDamage(false);
            }, 2000);
          }}
        >
          <Text style={styles.testButtonText}>Test: Being Attacked</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: '#4CAF50' }]}
          onPress={onOpponentDodged}
        >
          <Text style={styles.testButtonText}>Test: Target Dodged</Text>
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
  dodgeButton: {
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
  assassinateButton: {
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
  killButton: {
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
  testButtonContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  testButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
});
