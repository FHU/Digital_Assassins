import { useThemeColor } from "@/hooks/useThemeColor";
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function WaitingLobbyScreen() {
  const router = useRouter();
  const { code, username } = useLocalSearchParams<{
    code: string;
    username: string;
  }>();

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const dangerColor = useThemeColor({}, "danger");

  const [players, setPlayers] = useState<string[]>([]);
  const [lobbyName, setLobbyName] = useState("");
  const [hostName, setHostName] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh lobby data from database
  const refreshLobby = useCallback(async () => {
    if (!code) return;

    try {
      const lobby = await databaseLobbyStore.getLobbyByCode(code);
      if (lobby) {
        setPlayers(lobby.players);
        setLobbyName(lobby.name);
        setHostName(lobby.hostUsername);
      }
    } catch (error) {
      console.error('Error refreshing lobby:', error);
    }
  }, [code]);

  // Set up polling when screen is focused
  useFocusEffect(
    useCallback(() => {
      refreshLobby();

      // Poll for updates every 1 second
      const interval = setInterval(refreshLobby, 1000);

      return () => clearInterval(interval);
    }, [refreshLobby])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshLobby();
    setIsRefreshing(false);
  };

  const handleLeaveLobby = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
    headerCard: {
      backgroundColor: tintColor + "15",
      borderRadius: 12,
      padding: 20,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: tintColor + "33",
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: textColor,
      textAlign: "center",
    },
    lobbyInfo: {
      gap: 8,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    infoLabel: {
      fontSize: 14,
      color: textColor + "99",
      fontWeight: "500",
    },
    infoValue: {
      fontSize: 14,
      color: textColor,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: textColor + "33",
      marginVertical: 8,
    },
    participantsSection: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: textColor,
      marginBottom: 12,
    },
    participantCount: {
      fontSize: 14,
      color: textColor + "99",
      marginBottom: 12,
    },
    participantsList: {
      gap: 10,
    },
    participantCard: {
      backgroundColor: tintColor + "10",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: tintColor + "33",
    },
    participantUsername: {
      fontSize: 16,
      fontWeight: "600",
      color: textColor,
    },
    hostBadge: {
      fontSize: 12,
      color: primaryColor,
      fontWeight: "600",
      marginTop: 4,
    },
    waitingMessage: {
      marginHorizontal: 16,
      marginVertical: 20,
      padding: 16,
      backgroundColor: primaryColor + "20",
      borderRadius: 10,
      borderLeftWidth: 4,
      borderLeftColor: primaryColor,
    },
    waitingMessageText: {
      fontSize: 14,
      color: textColor,
      fontWeight: "500",
      textAlign: "center",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 30,
    },
    emptyStateText: {
      fontSize: 16,
      color: textColor + "99",
    },
    buttonContainer: {
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "white",
    },
    leaveButton: {
      backgroundColor: dangerColor,
    },
    loadingIndicator: {
      fontSize: 12,
      color: textColor + "99",
      fontStyle: "italic",
      marginTop: 4,
    },
  });

  if (!code || !username) {
    return (
      <View style={[styles.container]}>
        <View style={styles.headerCard}>
          <Text style={[styles.title, { color: dangerColor }]}>
            Invalid Access
          </Text>
          <Text style={[styles.waitingMessageText]}>
            Unable to load lobby. Please try again.
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => router.push("/")}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={primaryColor}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Lobby Info Header */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>Waiting for Game Start</Text>

          <View style={styles.divider} />

          <View style={styles.lobbyInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lobby Name:</Text>
              <Text style={styles.infoValue}>{lobbyName || "Loading..."}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lobby Code:</Text>
              <Text style={styles.infoValue}>{code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Host:</Text>
              <Text style={styles.infoValue}>{hostName || "Loading..."}</Text>
            </View>
          </View>
        </View>

        {/* Waiting Message */}
        <View style={styles.waitingMessage}>
          <Text style={styles.waitingMessageText}>
            🎮 Waiting for the host to start the game...
          </Text>
          <Text style={styles.loadingIndicator}>
            You will be notified when the game begins
          </Text>
        </View>

        {/* Participants List */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Players in Lobby</Text>
          <Text style={styles.participantCount}>
            {players.length} player{players.length !== 1 ? "s" : ""}
          </Text>

          {players.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No players yet</Text>
            </View>
          ) : (
            <View style={styles.participantsList}>
              {players.map((playerName) => (
                <View key={playerName} style={styles.participantCard}>
                  <Text style={styles.participantUsername}>
                    {playerName}
                  </Text>
                  {playerName === hostName && (
                    <Text style={styles.hostBadge}>👑 Host</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Leave Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.leaveButton]}
          onPress={handleLeaveLobby}
        >
          <Text style={styles.buttonText}>Leave Lobby</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
