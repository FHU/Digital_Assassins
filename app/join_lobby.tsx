import { useThemeColor } from "@/hooks/useThemeColor";
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";

interface Lobby {
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
}

export default function JoinLobbyScreen() {
  const router = useRouter();
  const deviceId = useDeviceId();
  const { code } = useLocalSearchParams<{ code: string }>();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const dangerColor = useThemeColor({}, "danger");

  const [username, setUsername] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch lobby data on mount
  useEffect(() => {
    fetchLobby();
  }, [code]);

  const fetchLobby = async () => {
    if (!code) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const lobbyData = await databaseLobbyStore.getLobbyByCode(code);
      setLobby(lobbyData);
    } catch (error) {
      console.error('Error fetching lobby:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: tintColor + "15",
      borderRadius: 12,
      padding: 24,
      width: "100%",
      gap: 20,
      borderWidth: 1,
      borderColor: tintColor + "33",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: textColor,
      textAlign: "center",
    },
    lobbyName: {
      fontSize: 20,
      fontWeight: "600",
      color: textColor,
      textAlign: "center",
      marginBottom: 8,
    },
    lobbyCode: {
      fontSize: 16,
      color: textColor + "99",
      textAlign: "center",
    },
    divider: {
      height: 1,
      backgroundColor: textColor + "33",
      marginVertical: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: textColor,
      marginBottom: 8,
    },
    input: {
      borderWidth: 2,
      borderColor: primaryColor,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: textColor,
      backgroundColor: backgroundColor,
    },
    info: {
      fontSize: 13,
      color: textColor + "99",
      textAlign: "center",
      marginTop: 8,
    },
    buttonContainer: {
      gap: 12,
      marginTop: 8,
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
    },
    joinButton: {
      backgroundColor: primaryColor,
    },
    cancelButton: {
      backgroundColor: dangerColor,
    },
    errorText: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 20,
      textAlign: "center",
    },
  });

  if (!code) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.errorText, { color: dangerColor }]}>
          Invalid lobby code
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: tintColor }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: "white" }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={{ color: textColor, marginTop: 16 }}>Loading lobby...</Text>
      </View>
    );
  }

  if (!lobby) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.errorText, { color: dangerColor }]}>
          Lobby not found
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: tintColor }]}
          onPress={() => router.push("/join")}
        >
          <Text style={[styles.buttonText, { color: "white" }]}>
            Try Another Code
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleJoin = async () => {
    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter a username to join.");
      return;
    }

    setIsJoining(true);

    try {
      // Add player to lobby in database
      await databaseLobbyStore.addParticipantToLobby(
        code,
        deviceId,
        username.trim()
      );

      Alert.alert("Successfully Joined!", "Waiting for the game to start...", [
        {
          text: "OK",
          onPress: () => {
            // Navigate to the waiting lobby screen
            router.push(
              `/waiting_lobby?code=${code}&username=${encodeURIComponent(username.trim())}` as never
            );
          },
        },
      ]);
    } catch (error) {
      console.error('Error joining lobby:', error);
      Alert.alert("Error", "Failed to join lobby. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Join Lobby</Text>

          <View>
            <Text style={styles.lobbyName}>{lobby.name}</Text>
            <Text style={styles.lobbyCode}>Code: {lobby.code}</Text>
          </View>

          <View style={styles.divider} />

          <View>
            <Text style={styles.label}>Enter Your Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={textColor + "66"}
              value={username}
              onChangeText={setUsername}
              maxLength={20}
              editable={!isJoining}
              autoCapitalize="words"
            />
            <Text style={styles.info}>{username.length}/20 characters</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.joinButton]}
              onPress={handleJoin}
              disabled={isJoining || !username.trim()}
            >
              <Text style={[styles.buttonText, { color: "white" }]}>
                {isJoining ? "Joining..." : "Join Game"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => router.back()}
              disabled={isJoining}
            >
              <Text style={[styles.buttonText, { color: "white" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.info}>
            {lobby.players.length} player
            {lobby.players.length !== 1 ? "s" : ""} in lobby
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
