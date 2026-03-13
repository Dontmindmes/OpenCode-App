import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";

import { colors, radii, spacing, type } from "../constants/theme";
import { opencodeApi } from "../lib/opencode";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { EmptyState } from "../components/EmptyState";
import { ListRow } from "../components/ListRow";
import { Panel } from "../components/Panel";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";

function inferTemplate(methods) {
  const types = (methods || []).map((item) => item.type);
  if (types.includes("api")) {
    return '{\n  "type": "api",\n  "key": ""\n}';
  }
  if (types.includes("oauth")) {
    return '{\n  "type": "oauth",\n  "refresh": "",\n  "access": "",\n  "expires": 0\n}';
  }
  return '{\n  "type": "api",\n  "key": ""\n}';
}

export function ProviderAuthScreen() {
  const { host } = useSelectedHost();
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [payload, setPayload] = useState('{\n  "type": "api",\n  "key": ""\n}');

  const [providersQuery, providerAuthQuery] = useQueries({
    queries: [
      { queryKey: ["provider-auth-providers", host?.id], queryFn: () => opencodeApi.getProviders(host), enabled: !!host },
      { queryKey: ["provider-auth-methods", host?.id], queryFn: () => opencodeApi.getProviderAuth(host), enabled: !!host },
    ],
  });

  const providers = useMemo(() => (providersQuery.data?.all ? Object.values(providersQuery.data.all) : []), [providersQuery.data]);
  const methodsByProvider = providerAuthQuery.data || {};
  const selectedMethods = selectedProvider ? methodsByProvider[selectedProvider] || [] : [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = JSON.parse(payload);
      return opencodeApi.setAuth(host, selectedProvider, body);
    },
    onSuccess: async () => {
      Alert.alert("Saved", "Provider credentials were sent to the OpenCode host.");
      await providersQuery.refetch();
    },
    onError: (error) => Alert.alert("Could not save provider auth", error.message),
  });

  return (
    <Screen>
      <SectionHeader eyebrow="Provider Auth" title="Connect models" />

      <Panel>
        <SectionHeader eyebrow="Providers" title="Available providers" />
        {providers.length ? (
          <View style={styles.list}>
            {providers.map((provider) => {
              const methods = methodsByProvider[provider.id] || [];
              return (
                <ListRow
                  key={provider.id}
                  title={provider.name || provider.id}
                  subtitle={methods.map((method) => method.label).join(", ") || "No auth methods exposed"}
                  meta={<Pill active={selectedProvider === provider.id}>{selectedProvider === provider.id ? "Selected" : "Open"}</Pill>}
                  onPress={() => {
                    setSelectedProvider(provider.id);
                    setPayload(inferTemplate(methods));
                  }}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState title="No providers available" body="The host did not return a provider catalog." />
        )}
      </Panel>

      <Panel>
        <SectionHeader eyebrow="Credential Payload" title={selectedProvider || "Select a provider"} />
        {selectedProvider ? (
          <>
            <View style={styles.inlineRow}>
              {selectedMethods.map((method) => (
                <Pill key={`${selectedProvider}-${method.type}`} tone="cool">{method.label}</Pill>
              ))}
            </View>
            <Text style={styles.supporting}>Paste the auth payload expected by OpenCode for this provider. API-key providers usually use `{`"type":"api","key":"..."`}`.</Text>
            <TextInput multiline value={payload} onChangeText={setPayload} style={styles.textarea} placeholderTextColor={colors.textDim} />
            <PrimaryButton label={saveMutation.isPending ? "Saving..." : "Save to host"} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending || !selectedProvider} />
          </>
        ) : (
          <EmptyState title="No provider selected" body="Choose a provider above to enter credentials." />
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  supporting: {
    color: colors.textMuted,
    fontFamily: type.body,
    lineHeight: 21,
  },
  textarea: {
    minHeight: 200,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(255, 244, 222, 0.06)",
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
    fontFamily: type.mono,
    fontSize: 12,
    lineHeight: 18,
  },
});
