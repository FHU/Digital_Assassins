import { useThemeColor } from "@/hooks/useThemeColor";
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LobbyCode from "./lobby_code";
import LobbyName from "./lobby_name";
import ParticipantList from "./participant_list";

interface Lobby {
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
}

export default function HostScreen() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize lobby on mount
  useFocusEffect(
    useCallback(() => {
      initializeLobby();
    }, [deviceId])
  );

  const initializeLobby = async () => {
    try {
      setIsLoading(true);

      // Check if there's already an active lobby for this device
      const existingLobby = await databaseLobbyStore.getCurrentActiveLobby(deviceId);

      if (existingLobby) {
        setLobby(existingLobby);
      } else {
        // Create a new lobby
        const newLobby = await databaseLobbyStore.createLobby(
          deviceId,
          "Host",
          "Game Night"
        );
        setLobby(newLobby);
      }
    } catch (error) {
      console.error('Error initializing lobby:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hostParticipants = lobby?.players || [];

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
    lobbyInfoContainer: {
      gap: 12,
    },
    participantListWrapper: {
      flex: 1,
      minHeight: 200,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: textColor,
      overflow: "hidden",
    },
    bottomButtonContainer: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      gap: 12,
    },
    startGameButton: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      backgroundColor: tintColor,
      borderRadius: 8,
      alignItems: "center",
    },
    buttonText: {
      color: "black",
      fontSize: 16,
      fontWeight: "600",
    },
    backButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: tintColor,
      borderRadius: 8,
      alignItems: "center",
    },
    backButtonText: {
      color: "black",
      fontSize: 16,
      fontWeight: "600",
    },
  });

  // Don't render until lobby is loaded
  if (isLoading || !lobby) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={{ color: textColor, marginTop: 16 }}>Initializing lobby...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Host Match</Text>

        <View style={styles.lobbyInfoContainer}>
          <LobbyName name={lobby.name} />
          <LobbyCode code={lobby.code} />
        </View>

        <View style={styles.participantListWrapper}>
          <ParticipantList initialParticipants={hostParticipants} />
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.startGameButton}
          onPress={() => {
            if (lobby) {
              startGame(lobby.code);
            }
            router.push("/ble-scanning");
          }}
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/")}
        >
          <Text style={styles.backButtonText}>Back Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
