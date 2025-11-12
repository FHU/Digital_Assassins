import { Text, View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  code: string;
}

export default function LobbyCode({ code }: Props) {
  const dangerColor = useThemeColor({}, "danger");

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 24,
      paddingHorizontal: 20,
      backgroundColor: dangerColor,
      borderRadius: 16,
      alignItems: "center",
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: "#fff",
      opacity: 0.9,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    code: {
      fontSize: 48,
      fontWeight: "900",
      color: "#fff",
      letterSpacing: 4,
      fontFamily: "monospace",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: "500",
      color: "#fff",
      opacity: 0.8,
      marginTop: 4,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Share This Code</Text>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.subtitle}>Players will enter this to join</Text>
    </View>
  );
}
