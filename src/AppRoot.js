import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { AppProviders } from "./providers/AppProviders";
import { colors, type } from "./constants/theme";
import { useAppStore } from "./store/appStore";
import { ConnectScreen } from "./screens/ConnectScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

const Stack = createNativeStackNavigator();

function Bootstrap() {
  const hydrated = useAppStore((state) => state.hydrated);
  const selectedHostId = useAppStore((state) => state.selectedHostId);
  const hydrate = useAppStore((state) => state.hydrate);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated || !fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading OpenCode...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={selectedHostId ? "Workspace" : "Connect"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundTop },
      }}
    >
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="Workspace" component={WorkspaceScreen} />
      <Stack.Screen name="Session" getComponent={() => require("./screens/SessionScreen").SessionScreen} />
    </Stack.Navigator>
  );
}

export default function AppRoot() {
  return (
    <AppProviders>
      <Bootstrap />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.backgroundTop,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 16,
  },
});
