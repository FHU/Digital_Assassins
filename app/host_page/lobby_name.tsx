import { Text, View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  name: string;
}

export default function LobbyName({ name }: Props) {
  const primaryColor = useThemeColor({}, "primary");

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 20,
      paddingHorizontal: 20,
      backgroundColor: primaryColor,
      borderRadius: 12,
      alignItems: "center",
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: "#fff",
      opacity: 0.8,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    text: {
      fontSize: 28,
      fontWeight: "700",
      color: "#fff",
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Lobby Name</Text>
      <Text style={styles.text}>{name}</Text>
    </View>
  );
}
