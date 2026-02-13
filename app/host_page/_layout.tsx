import { Stack } from "expo-router";

export default function HostPageLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="host" options={{ title: "Host Match" }} />
      <Stack.Screen name="host-game" options={{ title: "Host Game" }} />
      <Stack.Screen name="lobby_code" options={{ title: "Lobby Code" }} />
      <Stack.Screen name="lobby_name" options={{ title: "Lobby Name" }} />
      <Stack.Screen name="participant_list" options={{ title: "Participants" }} />
      <Stack.Screen name="participant" options={{ title: "Participant" }} />
    </Stack>
  );
}
