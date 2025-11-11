import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import {
  getLobbyByCode,
  addParticipantToLobby,
} from "@/services/LobbyStore";

export default function JoinLobbyScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const dangerColor = useThemeColor({}, "danger");

  const [username, setUsername] = useState("");
  const [isJoining, setIsJoining] = useState(false);

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
          <Text style={[styles.buttonText, { color: backgroundColor }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lobby = getLobbyByCode(code);

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
          <Text style={[styles.buttonText, { color: backgroundColor }]}>
            Try Another Code
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleJoin = () => {
    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter a username to join.");
      return;
    }

    setIsJoining(true);

    // Simulate network delay
    setTimeout(() => {
      addParticipantToLobby(code, username.trim());
      setIsJoining(false);

      Alert.alert("Successfully Joined!", "Waiting for the game to start...", [
        {
          text: "OK",
          onPress: () => {
            // For now, navigate back to home
            // In the future, this could navigate to a player lobby view
            router.push("/");
          },
        },
      ]);
    }, 500);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: tintColor,
      borderRadius: 12,
      padding: 24,
      width: "100%",
      gap: 20,
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

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: tintColor }]}>
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
            <Text style={styles.info}>
              {username.length}/20 characters
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.joinButton]}
              onPress={handleJoin}
              disabled={isJoining || !username.trim()}
            >
              <Text style={[styles.buttonText, { color: backgroundColor }]}>
                {isJoining ? "Joining..." : "Join Game"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => router.back()}
              disabled={isJoining}
            >
              <Text style={[styles.buttonText, { color: backgroundColor }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.info}>
            {lobby.participants.length} player{lobby.participants.length !== 1 ? "s" : ""} in lobby
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
