import { Text, View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  code: string;
}

export default function LobbyCode({ code }: Props) {
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: tintColor,
      borderRadius: 12,
      alignItems: "center",
    },
    label: {
      fontSize: 14,
      fontWeight: "500",
      color: "#fff",
      opacity: 0.8,
      marginBottom: 8,
    },
    code: {
      fontSize: 28,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 2,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>LOBBY CODE</Text>
      <Text style={styles.code}>{code}</Text>
    </View>
  );
}
