import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomePage() {
  const yellow = useThemeColor({}, "primary");
  const red = useThemeColor({}, "danger");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    titleContainer: {
      marginBottom: 80,
      alignItems: "center",
    },
    title: {
      fontSize: 48,
      fontWeight: "900",
      color: textColor,
      textAlign: "center",
      letterSpacing: 1,
    },
    subtitle: {
      fontSize: 16,
      color: textColor,
      opacity: 0.6,
      marginTop: 10,
      textAlign: "center",
    },
    buttonsContainer: {
      width: "100%",
      maxWidth: 300,
      gap: 16,
    },
    button: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    hostButton: {
      backgroundColor: yellow,
    },
    joinButton: {
      backgroundColor: red,
      borderWidth: 2,
      borderColor: tintColor,
    },
    buttonText: {
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    hostButtonText: {
      color: textColor,
    },
    joinButtonText: {
      color: textColor,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Digital Assassin</Text>
        <Text style={styles.subtitle}>Play Covert Games with Friends</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.hostButton]}
          onPress={() => router.push("/host")}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, styles.hostButtonText]}>Host</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.joinButton]}
          onPress={() => router.push("/join")}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, styles.joinButtonText]}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
