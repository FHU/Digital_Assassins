import { Text, View, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import LobbyName from "./lobby_name";
import LobbyCode from "./lobby_code";
import ParticipantList from "./participant_list";

export default function HostScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  const fakeParticipants = [
    "Tiger42X",
    "Eagle89K",
    "Panda55M",
    "Dolphin21L",
  ];

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
      color: "#fff",
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
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Host Match</Text>

        <View style={styles.lobbyInfoContainer}>
          <LobbyName name="Epic Game Night" />
          <LobbyCode code="ABC123XYZ9" />
        </View>

        <View style={styles.participantListWrapper}>
          <ParticipantList initialParticipants={fakeParticipants} />
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.startGameButton}
          onPress={() => {}}
        >
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
