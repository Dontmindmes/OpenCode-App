import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { colors, radii, spacing, type } from "../constants/theme";
import { opencodeApi, normalizeBaseUrl } from "../lib/opencode";
import { truncateMiddle } from "../lib/format";
import { useAppStore } from "../store/appStore";
import { EmptyState } from "../components/EmptyState";
import { Panel } from "../components/Panel";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";

function createId() {
  return `host-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ConnectScreen({ navigation }) {
  const hosts = useAppStore((state) => state.hosts);
  const addOrUpdateHost = useAppStore((state) => state.addOrUpdateHost);
  const selectHost = useAppStore((state) => state.selectHost);
  const removeHost = useAppStore((state) => state.removeHost);
  const [name, setName] = useState("Studio Mac");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:4096");
  const [username, setUsername] = useState("opencode");
  const [password, setPassword] = useState("");

  const connectMutation = useMutation({
    mutationFn: async () => {
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const host = {
        baseUrl: normalizedUrl,
        username: username.trim() || "opencode",
        password: password.trim(),
      };

      const health = await opencodeApi.health(host);
      const currentProject = await opencodeApi.currentProject(host).catch(() => null);

      return {
        health,
        currentProject,
        host,
      };
    },
    onSuccess: async ({ host, currentProject }) => {
      const id = createId();
      await addOrUpdateHost(
        {
          id,
          name: name.trim() || "OpenCode Host",
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
      Alert.alert("Connection failed", error.message || "OpenCode host is not reachable.");
    },
  });

  const helperText = useMemo(
    () =>
      password.trim()
        ? "Using Basic Auth. This matches OPENCODE_SERVER_PASSWORD on the host."
        : "No password set. This is fine for local-only hosts.",
    [password],
  );

  return (
    <Screen>
      <SectionHeader eyebrow="Direct Host Mode" title="Connect your OpenCode machine" />

      <Panel>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>One app, one host, full session control.</Text>
          <Text style={styles.heroBody}>
            Point the app at a machine already running `opencode serve` or `opencode web`. The host does the code work. This app handles sessions, project targeting, model selection, and live control.
          </Text>
        </View>
      </Panel>

      <Panel>
        <View style={styles.form}>
          <Field label="Host label" value={name} onChangeText={setName} placeholder="Studio Mac" />
          <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="http://192.168.1.20:4096" autoCapitalize="none" />
          <View style={styles.row}>
            <Field label="Username" value={username} onChangeText={setUsername} placeholder="opencode" style={styles.flex} autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="optional" style={styles.flex} secureTextEntry autoCapitalize="none" />
          </View>
          <Text style={styles.helper}>{helperText}</Text>
          <PrimaryButton label={connectMutation.isPending ? "Connecting..." : "Save and connect"} onPress={() => connectMutation.mutate()} disabled={connectMutation.isPending || !baseUrl.trim()} />
        </View>
      </Panel>

      <SectionHeader eyebrow="Saved Hosts" title="Reconnect fast" />
      {hosts.length ? (
        hosts.map((host) => (
          <Panel key={host.id}>
            <View style={styles.savedHostRow}>
              <Pressable
                style={styles.savedHostCopy}
                onPress={async () => {
                  await selectHost(host.id);
                  navigation.replace("Workspace");
                }}
              >
                <Text style={styles.savedHostName}>{host.name}</Text>
                <Text style={styles.savedHostMeta}>{truncateMiddle(host.baseUrl, 24, 18)}</Text>
              </Pressable>
              <PrimaryButton label="Remove" tone="ghost" onPress={() => removeHost(host.id)} style={styles.removeButton} />
            </View>
          </Panel>
        ))
      ) : (
        <EmptyState title="No hosts yet" body="Start by connecting to the OpenCode server running on your computer or another machine on your network." />
      )}
    </Screen>
  );
}

function Field({ label, style, ...props }) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textDim} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroCopy: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 28,
    lineHeight: 32,
  },
  heroBody: {
    color: colors.textMuted,
    fontFamily: type.body,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: type.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: "rgba(255, 244, 222, 0.06)",
    fontFamily: type.body,
    fontSize: 15,
  },
  helper: {
    color: colors.textDim,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 20,
  },
  savedHostRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  savedHostCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  savedHostName: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 18,
  },
  savedHostMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  removeButton: {
    minWidth: 92,
  },
});
