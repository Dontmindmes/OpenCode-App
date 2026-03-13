import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";

import { colors, spacing, type } from "../constants/theme";
import { truncateMiddle } from "../lib/format";
import { opencodeApi } from "../lib/opencode";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { EmptyState } from "../components/EmptyState";
import { Panel } from "../components/Panel";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useAppStore } from "../store/appStore";

export function SettingsScreen({ navigation }) {
  const { host, meta } = useSelectedHost();
  const hosts = useAppStore((state) => state.hosts);
  const selectHost = useAppStore((state) => state.selectHost);
  const removeHost = useAppStore((state) => state.removeHost);

  const [healthQuery, pathQuery, vcsQuery, providersQuery, providerAuthQuery] = useQueries({
    queries: [
      { queryKey: ["settings-health", host?.id], queryFn: () => opencodeApi.health(host), enabled: !!host },
      { queryKey: ["settings-path", host?.id], queryFn: () => opencodeApi.getPath(host), enabled: !!host },
      { queryKey: ["settings-vcs", host?.id], queryFn: () => opencodeApi.getVcs(host), enabled: !!host },
      { queryKey: ["settings-providers", host?.id], queryFn: () => opencodeApi.getProviders(host), enabled: !!host },
      { queryKey: ["settings-provider-auth", host?.id], queryFn: () => opencodeApi.getProviderAuth(host), enabled: !!host },
    ],
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeHost(meta.id),
    onSuccess: () => navigation.replace("Connect"),
    onError: (error) => Alert.alert("Could not remove host", error.message),
  });

  if (!host || !meta) {
    return (
      <Screen>
        <SectionHeader eyebrow="Host" title="No host selected" />
      </Screen>
    );
  }

  const providers = providersQuery.data?.all ? Object.values(providersQuery.data.all) : [];
  const connectedProviders = providersQuery.data?.connected || [];
  const providerAuth = providerAuthQuery.data || {};

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionHeader eyebrow="Host Settings" title={meta.name} />

        <Panel>
          <View style={styles.group}>
            <Text style={styles.label}>Base URL</Text>
            <Text style={styles.value}>{truncateMiddle(meta.baseUrl, 28, 18)}</Text>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value}>{meta.username || "opencode"}</Text>
            <Text style={styles.label}>Health</Text>
            <Text style={styles.value}>{healthQuery.data?.healthy ? `Healthy · ${healthQuery.data.version}` : "Check failed or still loading"}</Text>
            <Text style={styles.label}>Directory</Text>
            <Text style={styles.value}>{pathQuery.data?.directory || "Unknown"}</Text>
            <Text style={styles.label}>Branch</Text>
            <Text style={styles.value}>{vcsQuery.data?.branch || "No VCS detected"}</Text>
          </View>
        </Panel>

        <Panel>
          <View style={styles.group}>
            <Text style={styles.sectionTitle}>Providers</Text>
            {providers.length ? (
              providers.map((provider) => (
                <View key={provider.id} style={styles.providerRow}>
                  <View style={styles.providerCopy}>
                    <Text style={styles.value}>{provider.name || provider.id}</Text>
                    <Text style={styles.copy}>{connectedProviders.includes(provider.id) ? "Connected" : "Not connected"}</Text>
                  </View>
                  <View style={styles.providerMeta}>
                    <Pill active={connectedProviders.includes(provider.id)}>{connectedProviders.includes(provider.id) ? "Live" : "Idle"}</Pill>
                    {providerAuth[provider.id]?.map((method) => (
                      <Pill key={`${provider.id}-${method.type}`} tone="cool">{method.label}</Pill>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title="No providers loaded" body="The host did not expose a provider catalog yet." />
            )}
          </View>
        </Panel>

        <Panel>
          <View style={styles.group}>
            <Text style={styles.sectionTitle}>Switch host</Text>
            {hosts.map((item) => (
              <PrimaryButton key={item.id} label={item.name} tone={item.id === meta.id ? "accent" : "subtle"} onPress={() => selectHost(item.id)} />
            ))}
          </View>
        </Panel>

        <Panel>
          <View style={styles.group}>
            <Text style={styles.sectionTitle}>Danger zone</Text>
            <Text style={styles.copy}>Removing this host deletes its saved password from secure storage and returns the app to the connect screen.</Text>
            <PrimaryButton label={deleteMutation.isPending ? "Removing..." : "Remove this host"} tone="danger" onPress={() => deleteMutation.mutate()} />
          </View>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  group: { gap: spacing.sm },
  label: { color: colors.textDim, fontFamily: type.mono, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  value: { color: colors.text, fontFamily: type.body, lineHeight: 22 },
  sectionTitle: { color: colors.text, fontFamily: type.heading, fontSize: 20 },
  copy: { color: colors.textMuted, fontFamily: type.body, lineHeight: 21 },
  providerRow: { gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  providerCopy: { gap: 2 },
  providerMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
