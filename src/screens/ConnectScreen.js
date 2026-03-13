import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { colors, radii, spacing, type } from "../constants/theme";
import { opencodeApi, normalizeBaseUrl } from "../lib/opencode";
import { truncateMiddle } from "../lib/format";
import { useAppStore } from "../store/appStore";
import { EmptyState } from "../components/EmptyState";
import { Panel } from "../components/Panel";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";

function createId() {
  return `host-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ConnectScreen({ navigation }) {
  const hosts = useAppStore((state) => state.hosts);
  const addOrUpdateHost = useAppStore((state) => state.addOrUpdateHost);
  const selectHost = useAppStore((state) => state.selectHost);
  const removeHost = useAppStore((state) => state.removeHost);

  const [name, setName] = useState(hosts[0]?.name || "My Server");
  const [baseUrl, setBaseUrl] = useState(hosts[0]?.baseUrl || "http://127.0.0.1:4096");
  const [username, setUsername] = useState(hosts[0]?.username || "opencode");
  const [password, setPassword] = useState("");

  const connectMutation = useMutation({
    mutationFn: async () => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const host = {
        baseUrl: normalizedUrl,
        username: username.trim() || "opencode",
        password: password.trim(),
      };

      const currentProject = await opencodeApi.currentProject(host).catch(() => null);
      await opencodeApi.health(host);

      return {
        currentProject,
        host,
      };
    },
    onSuccess: async ({ host, currentProject }) => {
      const id = createId();

      await addOrUpdateHost(
        {
          id,
          name: name.trim() || "OpenCode Server",
          baseUrl: host.baseUrl,
          username: host.username,
          lastSeenAt: new Date().toISOString(),
          projectHint: currentProject?.path || currentProject?.directory || null,
        },
        {
          username: host.username,
          password: host.password,
        },
      );

      navigation.replace("Workspace");
    },
    onError: (error) => {
      Alert.alert("Could not connect", error.message || "The server did not respond.");
    },
  });

  const helperText = useMemo(() => {
    if (password.trim()) {
      return "Password is only needed when your server has basic auth.";
    }
    return "For local servers you can usually leave this empty.";
  }, [password]);

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect</Text>
        <Text style={styles.subtitle}>Enter your OpenCode server address to get started.</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Server URL</Text>
          <TextInput
            placeholder="http://127.0.0.1:4096"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              placeholder="opencode"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              placeholder="Optional"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <Text style={styles.helper}>{helperText}</Text>

        <View style={styles.connectRow}>
          <View style={styles.connectIcon}>
            <Feather name="server" size={20} color={colors.text} />
          </View>
          <PrimaryButton
            label={connectMutation.isPending ? "Connecting..." : "Connect"}
            onPress={() => connectMutation.mutate()}
            disabled={connectMutation.isPending || !baseUrl.trim()}
            style={styles.connectButton}
          />
        </View>
      </View>

      {hosts.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedSectionTitle}>Saved Servers</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.savedList}>
            {hosts.map((host) => (
              <Pressable
                key={host.id}
                style={styles.savedCard}
                onPress={async () => {
                  await selectHost(host.id);
                  navigation.replace("Workspace");
                }}
              >
                <View style={styles.savedContent}>
                  <Text style={styles.savedName}>{host.name}</Text>
                  <Text style={styles.savedUrl}>{truncateMiddle(host.baseUrl, 32, 20)}</Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    removeHost(host.id);
                  }}
                  hitSlop={12}
                >
                  <Feather name="x" size={16} color={colors.textDim} />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {hosts.length === 0 && (
        <EmptyState title="No saved servers" body="Connect to a server and it will appear here for quick access." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  header: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  formCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldRow: {
    flexDirection: "column",
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textDim,
    fontFamily: type.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontFamily: type.body,
    fontSize: 15,
  },
  helper: {
    color: colors.textDim,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 16,
  },
  connectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  connectIcon: {
    display: "none",
  },
  connectButton: {
    flex: 1,
  },
  savedSection: {
    flex: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  savedSectionTitle: {
    color: colors.textDim,
    fontFamily: type.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  savedList: {
    gap: spacing.sm,
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  savedContent: {
    flex: 1,
    gap: 2,
  },
  savedName: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 15,
  },
  savedUrl: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
});
