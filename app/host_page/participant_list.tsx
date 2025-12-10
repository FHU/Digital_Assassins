import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Alert } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useState } from "react";
import Participant from "./participant";
import supabaseLobbyStore from "@/services/SupabaseLobbyStore";

interface Props {
  initialParticipants?: string[];
  lobbyCode?: string;
}

export default function ParticipantList({
  initialParticipants = [],
  lobbyCode = "",
}: Props) {
  const [participants, setParticipants] = useState<string[]>(
    initialParticipants
  );
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const dangerColor = useThemeColor({}, "danger");

  const addParticipant = (username: string) => {
    if (username.trim()) {
      setParticipants([...participants, username.trim()]);
    }
  };

  const removeParticipant = async (index: number) => {
    const usernameToRemove = participants[index];

    try {
      // Remove from database if lobby code is available
      if (lobbyCode) {
        await supabaseLobbyStore.removeParticipantFromLobby(lobbyCode, usernameToRemove);
      }

      // Remove from UI
      setParticipants(participants.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error removing participant:', error);
      Alert.alert('Error', 'Failed to remove participant');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
      paddingVertical: 16,
      paddingHorizontal: 12,
    },
    header: {
      fontSize: 18,
      fontWeight: "700",
      color: textColor,
      marginBottom: 16,
    },
    listContainer: {
      gap: 8,
    },
    participantWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    removeButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: dangerColor,
      borderRadius: 8,
      minWidth: 80,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    removeButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    emptyText: {
      fontSize: 14,
      color: textColor,
      opacity: 0.6,
      textAlign: "center",
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Participants ({participants.length})</Text>
      {participants.length === 0 ? (
        <Text style={styles.emptyText}>No participants yet</Text>
      ) : (
        <ScrollView>
          <View style={styles.listContainer}>
            {participants.map((username, index) => (
              <View key={index} style={styles.participantWrapper}>
                <View style={{ flex: 1 }}>
                  <Participant username={username} />
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeParticipant(index)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// Helper function to add participants from parent components
export function useParticipantList(initialParticipants: string[] = []) {
  const [participants, setParticipants] = useState<string[]>(
    initialParticipants
  );

  const addParticipant = (username: string) => {
    if (username.trim()) {
      setParticipants([...participants, username.trim()]);
    }
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  return {
    participants,
    addParticipant,
    removeParticipant,
    setParticipants,
  };
}
