import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function HostScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: textColor,
      marginBottom: 20,
      textAlign: "center",
    },
    placeholder: {
      fontSize: 16,
      color: textColor,
      opacity: 0.6,
      marginBottom: 40,
      textAlign: "center",
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
      <Text style={styles.title}>Host Match</Text>
      <Text style={styles.placeholder}>Host setup coming soon...</Text>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Back Home</Text>
      </TouchableOpacity>
    </View>
  );
}
