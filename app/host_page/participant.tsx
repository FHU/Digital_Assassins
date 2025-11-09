import { Text, View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  username: string;
}

export default function Participant({ username }: Props) {
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: textColor,
    },
    username: {
      fontSize: 16,
      fontWeight: "600",
      color: textColor,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.username}>{username}</Text>
    </View>
  );
}
