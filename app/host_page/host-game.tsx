import { useThemeColor } from "@/hooks/useThemeColor";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import supabaseLobbyStore, { supabase } from "@/services/SupabaseLobbyStore";
import gameHostService from "@/services/GameHostService";

interface GameStats {
  totalPlayers: number;
  alivePlayers: number;
  eliminatedPlayers: number;
}

interface Player {
  id: number;
  username: string;
  healthRemaining: number;
  status: string;
}

export default function HostGameScreen() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const dangerColor = useThemeColor({}, "danger");

  const [lobbyId, setLobbyId] = useState<number | null>(null);
  const [gameStats, setGameStats] = useState<GameStats>({
    totalPlayers: 0,
    alivePlayers: 0,
    eliminatedPlayers: 0,
  });
  const [alivePlayers, setAlivePlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const gameSubscriptionRef = useRef<any>(null);

  // Get lobby on mount
  useFocusEffect(
    useCallback(() => {
      initializeLobby();
    }, [deviceId])
  );

  const initializeLobby = async () => {
    try {
      setIsLoading(true);
      const activeLobby = await supabaseLobbyStore.getCurrentActiveLobby(deviceId);

      if (activeLobby && activeLobby.id) {
        setLobbyId(activeLobby.id);
        await refreshGameStats(activeLobby.id);
        subscribeToGameChanges(activeLobby.id);
      } else {
        Alert.alert("Error", "No active game found");
        router.replace("/host_page/host");
      }
    } catch (error) {
      console.error("Error initializing lobby:", error);
      Alert.alert("Error", "Failed to load game");
      router.replace("/host_page/host");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Subscribe to real-time changes in the game
   * This keeps stats updated as players are eliminated
   */
  const subscribeToGameChanges = (lobbyId: number) => {
    try {
      // Subscribe to player status changes
      gameSubscriptionRef.current = supabase
        .channel(`game-${lobbyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'player',
            filter: `lobbyId=eq.${lobbyId}`,
          },
          (payload: any) => {
            console.log("[Game Update]", payload);
            refreshGameStats(lobbyId);
          }
        )
        .subscribe();

      console.log("✓ Subscribed to game changes");
    } catch (error) {
      console.error("Error subscribing to game changes:", error);
    }
  };

  const refreshGameStats = async (lobbyId: number) => {
    try {
      const stats = await gameHostService.getGameStats(lobbyId);
      const players = await gameHostService.getAlivePlayers(lobbyId);

      setGameStats(stats);
      setAlivePlayers(players);

      // Check if game should end (only 1 player left)
      if (stats.alivePlayers <= 1 && stats.alivePlayers > 0) {
        console.log(`🎉 Game is ending! Only ${stats.alivePlayers} player(s) left.`);
      }
    } catch (error) {
      console.error("Error refreshing game stats:", error);
    }
  };

  const handleRefresh = async () => {
    if (!lobbyId) return;
    setIsRefreshing(true);
    try {
      await refreshGameStats(lobbyId);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEndGame = async () => {
    if (!lobbyId) return;

    Alert.alert(
      "End Game?",
      "This will kick all players out and clean up the game. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Game",
          style: "destructive",
          onPress: async () => {
            await endGame();
          },
        },
      ]
    );
  };

  const endGame = async () => {
    if (!lobbyId) return;

    try {
      setIsEnding(true);
      console.log("🛑 Host is ending the game...");

      // Notify all players first
      await gameHostService.notifyGameEnded(lobbyId);

      // Give players a moment to receive the notification
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Clean up database
      const success = await gameHostService.endGame(lobbyId);

      if (success) {
        Alert.alert("Game Ended", "All players have been kicked out.", [
          {
            text: "OK",
            onPress: () => {
              router.replace("/host_page/host");
            },
          },
        ]);
      } else {
        Alert.alert("Error", "Failed to end game properly");
      }
    } catch (error) {
      console.error("Error ending game:", error);
      Alert.alert("Error", "Failed to end game");
    } finally {
      setIsEnding(false);
    }
  };

  useEffect(() => {
    return () => {
      // Unsubscribe from game changes
      if (gameSubscriptionRef.current) {
        gameSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    scrollContent: {
      gap: 16,
      paddingBottom: 160,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: textColor,
      marginBottom: 8,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      fontWeight: "500",
      color: textColor,
      opacity: 0.7,
      textAlign: "center",
      marginBottom: 20,
    },
    statsContainer: {
      borderRadius: 8,
      padding: 16,
      backgroundColor: "rgba(128, 128, 128, 0.1)",
      gap: 12,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: textColor,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      color: tintColor,
    },
    playersContainer: {
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(128, 128, 128, 0.3)",
    },
    playersHeader: {
      backgroundColor: "rgba(128, 128, 128, 0.1)",
      padding: 12,
    },
    playersTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: textColor,
    },
    playerItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(128, 128, 128, 0.1)",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    playerName: {
      fontSize: 14,
      fontWeight: "500",
      color: textColor,
    },
    playerHealth: {
      fontSize: 12,
      color: textColor,
      opacity: 0.6,
    },
    emptyPlayers: {
      padding: 16,
      alignItems: "center",
    },
    emptyText: {
      color: textColor,
      opacity: 0.6,
      fontSize: 14,
    },
    bottomButtonContainer: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      gap: 12,
    },
    endGameButton: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      backgroundColor: dangerColor,
      borderRadius: 8,
      alignItems: "center",
    },
    endGameButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    refreshButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: tintColor,
      borderRadius: 8,
      alignItems: "center",
    },
    refreshButtonText: {
      color: "black",
      fontSize: 16,
      fontWeight: "600",
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: "center", alignItems: "center" }]}
      >
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={{ color: textColor, marginTop: 16 }}>Loading game...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.title}>Game Running</Text>
        <Text style={styles.subtitle}>Players are hunting...</Text>

        {/* Game Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Players</Text>
            <Text style={styles.statValue}>{gameStats.totalPlayers}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Alive</Text>
            <Text style={[styles.statValue, { color: "#4CAF50" }]}>
              {gameStats.alivePlayers}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Eliminated</Text>
            <Text style={[styles.statValue, { color: dangerColor }]}>
              {gameStats.eliminatedPlayers}
            </Text>
          </View>
        </View>

        {/* Alive Players List */}
        <View style={styles.playersContainer}>
          <View style={styles.playersHeader}>
            <Text style={styles.playersTitle}>🎯 Alive Players ({alivePlayers.length})</Text>
          </View>

          {alivePlayers.length > 0 ? (
            alivePlayers.map((player, index) => (
              <View
                key={player.id}
                style={[
                  styles.playerItem,
                  index === alivePlayers.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View>
                  <Text style={styles.playerName}>{player.username}</Text>
                  <Text style={styles.playerHealth}>
                    Health: {(player.healthRemaining / 1000).toFixed(1)}s
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: "#4CAF50", fontSize: 16 }]}>✓</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyPlayers}>
              <Text style={styles.emptyText}>No players alive</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={[styles.endGameButton, isEnding && { opacity: 0.5 }]}
          onPress={handleEndGame}
          disabled={isEnding}
        >
          <Text style={styles.endGameButtonText}>
            {isEnding ? "Ending Game..." : "End Game"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
