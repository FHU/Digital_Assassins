import JoinCodeInput from "@/components/JoinCodeInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useBluetooth } from "@/hooks/useBluetooth";
import supabaseLobbyStore from "@/services/SupabaseLobbyStore";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function JoinScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const { isBluetoothEnabled, enableBluetooth } = useBluetooth();

  const [isLoading, setIsLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>("");

  const handleBluetoothEnable = async () => {
    const success = await enableBluetooth();
    if (success && currentCode) {
      // Retry the code submission after enabling Bluetooth, bypassing the check
      await processCodeSubmit(currentCode);
    }
  };

  const processCodeSubmit = async (code: string) => {
    setIsLoading(true);

    try {
      // Query Supabase for the lobby
      const lobby = await supabaseLobbyStore.getLobbyByCode(code);

      if (!lobby) {
        Alert.alert("Invalid Code", "No lobby found with this code. Try again.");
        return;
      }

      // Navigate to join_lobby screen with code as param
      router.push({
        pathname: "/join_lobby",
        params: { code },
      });
    } catch (error) {
      console.error('Error looking up lobby:', error);
      Alert.alert("Error", "Failed to look up lobby. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (code: string) => {
    setCurrentCode(code);

    // Check if Bluetooth is enabled first
    if (!isBluetoothEnabled) {
      Alert.alert(
        "Bluetooth Required",
        "Bluetooth must be enabled to join a match",
        [
          {
            text: "Enable Bluetooth",
            onPress: handleBluetoothEnable,
          },
          {
            text: "Cancel",
            onPress: () => setCurrentCode(""),
          },
        ]
      );
      return;
    }

    // If Bluetooth is enabled, process the code
    await processCodeSubmit(code);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 40,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: textColor,
      marginBottom: 12,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: textColor + "99",
      marginBottom: 40,
      textAlign: "center",
    },
    inputSection: {
      marginBottom: 32,
    },
    buttonContainer: {
      gap: 12,
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Join Match</Text>
        <Text style={styles.subtitle}>
          Ask the host for their 6-digit join code
        </Text>

        <View style={styles.inputSection}>
          <JoinCodeInput
            onCodeSubmit={handleCodeSubmit}
            isLoading={isLoading}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
