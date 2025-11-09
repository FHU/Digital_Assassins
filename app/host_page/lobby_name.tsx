import { Text, View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  name: string;
}

export default function LobbyName({ name }: Props) {
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: textColor,
    },
    text: {
      fontSize: 18,
      fontWeight: "600",
      color: textColor,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{name}</Text>
    </View>
  );
}
