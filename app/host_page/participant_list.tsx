import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useState } from "react";
import Participant from "./participant";

interface Props {
  initialParticipants?: string[];
}

export default function ParticipantList({
  initialParticipants = [],
}: Props) {
  const [participants, setParticipants] = useState<string[]>(
    initialParticipants
  );
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");

  const addParticipant = (username: string) => {
    if (username.trim()) {
      setParticipants([...participants, username.trim()]);
    }
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
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
      gap: 8,
    },
    removeButton: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: tintColor,
      borderRadius: 6,
    },
    removeButtonText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
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
