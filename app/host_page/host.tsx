import { useThemeColor } from "@/hooks/useThemeColor";
import supabaseLobbyStore, { supabase } from "@/services/SupabaseLobbyStore";
import gameService from "@/services/gameService";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
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
      const existingLobby = await supabaseLobbyStore.getCurrentActiveLobby(deviceId);

      if (existingLobby) {
        setLobby(existingLobby);
      } else {
        // Create a new lobby
        const newLobby = await supabaseLobbyStore.createLobby(
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

  const handleStartGame = async () => {
    if (!lobby || !lobby.id) {
      Alert.alert('Error', 'Lobby not found');
      return;
    }

    try {
      setIsLoading(true);

      // Assign targets to all players
      await gameService.assignTargetsForLobby(lobby.id);

      // Update lobby status to "started"
      const { error } = await supabase
        .from('Lobby')
        .update({ status: 'started', startedAt: new Date().toISOString() })
        .eq('id', lobby.id);

      if (error) throw error;

      console.log('✓ Game started! Targets assigned.');

      // Navigate to BLE scanning screen
      router.push('/ble-scanning');
    } catch (error) {
      console.error('Error starting game:', error);
      Alert.alert('Error', 'Failed to start game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          style={[styles.startGameButton, isLoading && { opacity: 0.5 }]}
          onPress={handleStartGame}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Starting...' : 'Start Game'}
          </Text>
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
