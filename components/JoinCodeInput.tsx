import { useThemeColor } from "@/hooks/useThemeColor";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface Props {
  onCodeSubmit: (code: string) => void;
  isLoading?: boolean;
}

export default function JoinCodeInput({ onCodeSubmit, isLoading = false }: Props) {
  const [code, setCode] = useState("");
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const primaryColor = useThemeColor({}, "primary");
  const tintColor = useThemeColor({}, "tint");

  const handleCodeChange = (text: string) => {
    // Only allow uppercase alphanumeric, max 6 characters
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(cleanText);
  };

  const handleSubmit = () => {
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a 6-character code.");
      return;
    }
    onCodeSubmit(code);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: textColor }]}>Enter Join Code</Text>

      <View style={[styles.inputWrapper, { borderColor: primaryColor }]}>
        <TextInput
          style={[
            styles.codeInput,
            {
              color: textColor,
              backgroundColor: tintColor,
              borderColor: primaryColor,
            },
          ]}
          placeholder="XXXXXX"
          placeholderTextColor={textColor + "66"} // 40% opacity
          value={code}
          onChangeText={handleCodeChange}
          maxLength={6}
          editable={!isLoading}
          autoCapitalize="characters"
          keyboardType="default"
          selectTextOnFocus
        />

        <Text style={[styles.counter, { color: textColor + "99" }]}>
          {code.length}/6
        </Text>
      </View>

      <Text style={[styles.hint, { color: textColor + "99" }]}>
        6 characters (letters and numbers)
      </Text>

      <Pressable
        style={[
          styles.submitButton,
          {
            backgroundColor: primaryColor,
            opacity: code.length === 6 ? 1 : 0.5,
          },
        ]}
        onPress={handleSubmit}
        disabled={code.length !== 6 || isLoading}
      >
        <Text style={[styles.submitButtonText, { color: backgroundColor }]}>
          {isLoading ? "Validating..." : "Submit Code"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  inputWrapper: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 4,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontFamily: "monospace",
  },
  counter: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
