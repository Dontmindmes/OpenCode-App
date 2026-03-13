import { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";

import { colors, radii, spacing, type } from "../constants/theme";
import { normalizeEventPayload } from "../lib/events";
import { flattenModels, formatRelativeTime, matchSessionToProject, normalizeProject, sessionStatusLabel, sessionTitle, truncateMiddle } from "../lib/format";
import { opencodeApi } from "../lib/opencode";
import { useCoalescedInvalidate } from "../hooks/useCoalescedInvalidate";
import { buildReasoningConfigPatch, getAgentLabel, getReasoningProfile, primaryAgentsFirst, reasoningProfiles } from "../lib/profiles";
import { useEventStream } from "../hooks/useEventStream";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { EmptyState } from "../components/EmptyState";
import { ListRow } from "../components/ListRow";
import { ModalScreen } from "../components/ModalScreen";
import { Panel } from "../components/Panel";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { getRunProfile, useAppStore } from "../store/appStore";

export function WorkspaceScreen({ navigation }) {
  const { host, meta, loading } = useSelectedHost();
  const selectProject = useAppStore((state) => state.selectProject);
  const selectSession = useAppStore((state) => state.selectSession);
  const selectedProjectByHost = useAppStore((state) => state.selectedProjectByHost);
  const runProfile = useAppStore((state) => getRunProfile(state, meta?.id, selectedProjectByHost[meta?.id || ""] || null));
  const updateRunProfile = useAppStore((state) => state.updateRunProfile);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showCommandPicker, setShowCommandPicker] = useState(false);

  const selectedProjectHint = selectedProjectByHost[meta?.id || ""] || null;

  const queueInvalidate = useCoalescedInvalidate();

  const [healthQuery, projectsQuery, currentProjectQuery, pathQuery, vcsQuery, sessionsQuery, sessionStatusQuery, configProvidersQuery, configQuery, agentsQuery, commandsQuery] = useQueries({
    queries: [
      { queryKey: ["health", host?.id], queryFn: () => opencodeApi.health(host), enabled: !!host },
      { queryKey: ["projects", host?.id], queryFn: () => opencodeApi.listProjects(host), enabled: !!host },
      { queryKey: ["project-current", host?.id], queryFn: () => opencodeApi.currentProject(host), enabled: !!host },
      { queryKey: ["path", host?.id, selectedProjectHint], queryFn: () => opencodeApi.getPath(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["vcs", host?.id, selectedProjectHint], queryFn: () => opencodeApi.getVcs(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["sessions", host?.id, selectedProjectHint], queryFn: () => opencodeApi.listSessions(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["session-status", host?.id, selectedProjectHint], queryFn: () => opencodeApi.listSessionStatus(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["config-providers", host?.id, selectedProjectHint], queryFn: () => opencodeApi.getConfigProviders(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["config", host?.id, selectedProjectHint], queryFn: () => opencodeApi.getConfig(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["agents", host?.id, selectedProjectHint], queryFn: () => opencodeApi.listAgents(host, selectedProjectHint || undefined), enabled: !!host },
      { queryKey: ["commands", host?.id, selectedProjectHint], queryFn: () => opencodeApi.listCommands(host, selectedProjectHint || undefined), enabled: !!host },
    ],
  });

  const projects = useMemo(() => {
    const source = Array.isArray(projectsQuery.data) ? projectsQuery.data : [];
    const current = currentProjectQuery.data ? [currentProjectQuery.data] : [];
    const merged = [...current, ...source];
    const seen = new Set();

    return merged.map(normalizeProject).filter((project) => {
      if (!project.path || seen.has(project.path)) {
        return false;
      }
      seen.add(project.path);
      return true;
    });
  }, [currentProjectQuery.data, projectsQuery.data]);

  const selectedProjectPath = selectedProjectHint || projects[0]?.path || currentProjectQuery.data?.directory || null;
  const selectedProject = projects.find((project) => project.path === selectedProjectPath) || projects[0] || null;
  const models = useMemo(() => flattenModels(configProvidersQuery.data), [configProvidersQuery.data]);
  const agents = useMemo(() => primaryAgentsFirst(agentsQuery.data), [agentsQuery.data]);
  const commands = useMemo(() => (Array.isArray(commandsQuery.data) ? commandsQuery.data : []), [commandsQuery.data]);
  const selectedModelKey = runProfile.modelKey || configQuery.data?.model || null;

  const sessions = useMemo(() => {
    const all = Array.isArray(sessionsQuery.data) ? sessionsQuery.data : [];
    return all.filter((session) => matchSessionToProject(session, selectedProjectPath));
  }, [selectedProjectPath, sessionsQuery.data]);

  useEffect(() => {
    if (meta?.id && selectedProjectPath && selectedProjectByHost[meta.id] !== selectedProjectPath) {
      selectProject(meta.id, selectedProjectPath);
    }
  }, [meta?.id, selectProject, selectedProjectByHost, selectedProjectPath]);

  const refreshAll = async () => {
    await Promise.all([
      healthQuery.refetch(),
      projectsQuery.refetch(),
      currentProjectQuery.refetch(),
      pathQuery.refetch(),
      vcsQuery.refetch(),
      sessionsQuery.refetch(),
      sessionStatusQuery.refetch(),
      configProvidersQuery.refetch(),
      configQuery.refetch(),
      agentsQuery.refetch(),
      commandsQuery.refetch(),
    ]);
  };

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const session = await opencodeApi.createSession(
        host,
        newSessionTitle.trim() ? { title: newSessionTitle.trim() } : {},
        selectedProjectPath || undefined,
      );

      return session;
    },
    onSuccess: async (session) => {
      setNewSessionTitle("");
      await sessionsQuery.refetch();
      await selectSession(meta.id, selectedProjectPath, session.id);
      navigation.navigate("Session", {
        sessionId: session.id,
        projectPath: selectedProjectPath,
      });
    },
    onError: (error) => Alert.alert("Could not create session", error.message),
  });

  const applyRunProfileMutation = useMutation({
    mutationFn: async ({ modelKey, agentName, reasoning }) => {
      const patch = buildReasoningConfigPatch(agentName, reasoning, modelKey);
      if (patch) {
        await opencodeApi.updateConfig(host, patch, selectedProjectPath || undefined);
      }
      return true;
    },
    onError: (error) => Alert.alert("Could not apply host defaults", error.message),
  });

  useEventStream({
    host,
    projectPath: selectedProjectPath || undefined,
    enabled: !!host,
    onEvent: (payload) => {
      const normalized = normalizeEventPayload(payload);
      if (["session.created", "session.updated", "session.deleted", "session.status", "session.idle", "message.updated", "todo.updated"].includes(normalized.type)) {
        queueInvalidate(["sessions", meta?.id]);
        queueInvalidate(["session-status", meta?.id]);
      }
    },
  });

  if (!host) {
    return (
      <Screen>
        <SectionHeader eyebrow="Host" title={loading ? "Loading host..." : "Reconnect your host"} />
        {!loading ? (
          <Panel>
            <Text style={styles.supporting}>The selected host could not be resolved from secure storage. Connect again to continue.</Text>
            <PrimaryButton label="Back to connect" onPress={() => navigation.replace("Connect")} />
          </Panel>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <ScrollView
        refreshControl={<RefreshControl tintColor={colors.accent} refreshing={sessionsQuery.isRefetching} onRefresh={refreshAll} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          eyebrow="Connected Host"
          title={meta?.name || "OpenCode Host"}
          action={<PrimaryButton label="Host" tone="subtle" onPress={() => navigation.navigate("Settings")} />}
        />

        <Panel>
          <View style={styles.hostMeta}>
            <Text style={styles.hostUrl}>{truncateMiddle(host.baseUrl, 30, 22)}</Text>
          <View style={styles.inlineRow}>
              <Pill tone="cool">{healthQuery.data?.healthy ? `Healthy · ${healthQuery.data.version}` : "Waiting on health"}</Pill>
              <Pill>{commands.length} commands</Pill>
              <Pill>{agents.length} agents</Pill>
            </View>
            <Text style={styles.supporting}>Working directory: {pathQuery.data?.directory || selectedProject?.path || "Unknown"}</Text>
            <Text style={styles.supporting}>Branch: {vcsQuery.data?.branch || "No VCS detected"}</Text>
          </View>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="Project" title={selectedProject?.name || "Current folder"} />
          <Text style={styles.supporting}>{selectedProject?.path || currentProjectQuery.data?.directory || "No project metadata returned by the host."}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {projects.map((project) => (
              <Pill key={project.path} active={project.path === selectedProjectPath} onPress={() => selectProject(meta.id, project.path)}>
                {project.name}
              </Pill>
            ))}
          </ScrollView>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="Run Profile" title={`${getAgentLabel(runProfile.agent)} mode`} />
          <View style={styles.inlineRow}>
            <Pill active={runProfile.agent === "build"} onPress={() => updateRunProfile(meta.id, selectedProjectPath, { agent: "build" })}>Build</Pill>
            <Pill active={runProfile.agent === "plan"} tone="cool" onPress={() => updateRunProfile(meta.id, selectedProjectPath, { agent: "plan" })}>Plan</Pill>
            <Pill onPress={() => setShowAgentPicker(true)}>All agents</Pill>
          </View>
          <View style={styles.runMetaList}>
            <ListRow title={selectedModelKey || "Host default model"} subtitle="Model used for new prompts" onPress={() => setShowModelPicker(true)} meta={<Pill>Model</Pill>} />
            <ListRow title={getReasoningProfile(runProfile.reasoning).label} subtitle={getReasoningProfile(runProfile.reasoning).description} onPress={() => setShowModelPicker(true)} meta={<Pill>Reasoning</Pill>} />
          </View>
          <PrimaryButton
            label={applyRunProfileMutation.isPending ? "Applying..." : "Apply profile to host defaults"}
            tone="subtle"
            onPress={() =>
              applyRunProfileMutation.mutate({
                modelKey: selectedModelKey,
                agentName: runProfile.agent,
                reasoning: runProfile.reasoning,
              })
            }
          />
        </Panel>

        <Panel>
          <SectionHeader eyebrow="Commands" title="Reusable workflows" action={<PrimaryButton label="Browse" tone="subtle" onPress={() => setShowCommandPicker(true)} />} />
          {commands.length ? (
            <View style={styles.inlineRow}>
              {commands.slice(0, 4).map((command) => (
                <Pill key={command.name} onPress={() => setShowCommandPicker(true)}>
                  /{command.name}
                </Pill>
              ))}
            </View>
          ) : (
            <Text style={styles.supporting}>No custom commands are exposed for this project yet.</Text>
          )}
        </Panel>

        <Panel>
          <SectionHeader eyebrow="New Session" title="Start a run" />
          <TextInput
            placeholder="Optional title"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={newSessionTitle}
            onChangeText={setNewSessionTitle}
          />
          <Text style={styles.supporting}>New sessions start in {getAgentLabel(runProfile.agent)} mode with {selectedModelKey || "the host default model"}.</Text>
          <PrimaryButton label={createSessionMutation.isPending ? "Creating..." : "Create session"} onPress={() => createSessionMutation.mutate()} disabled={createSessionMutation.isPending} />
        </Panel>

        <SectionHeader eyebrow="Sessions" title="Recent conversations" />
        <View style={styles.sessionList}>
          {sessions.length ? (
            sessions.map((session) => {
              const status = sessionStatusQuery.data?.[session.id];
              return (
                <Panel key={session.id}>
                  <ListRow
                    title={sessionTitle(session)}
                    subtitle={`Updated ${formatRelativeTime(session.time?.updated)}`}
                    meta={<Pill active={sessionStatusLabel(status) === "busy"}>{sessionStatusLabel(status)}</Pill>}
                    onPress={async () => {
                      await selectSession(meta.id, selectedProjectPath, session.id);
                      navigation.navigate("Session", { sessionId: session.id, projectPath: selectedProjectPath });
                    }}
                  />
                  <Text style={styles.supportingMono}>{session.id}</Text>
                </Panel>
              );
            })
          ) : (
            <EmptyState title="No sessions here yet" body="Create the first session for this project and the stream will start filling in as the host works." />
          )}
        </View>
      </ScrollView>

      <AgentPickerModal
        visible={showAgentPicker}
        agents={agents}
        selectedAgent={runProfile.agent}
        onClose={() => setShowAgentPicker(false)}
        onPick={(agentName) => updateRunProfile(meta.id, selectedProjectPath, { agent: agentName })}
      />

      <ModelProfileModal
        visible={showModelPicker}
        models={models}
        selectedModelKey={selectedModelKey}
        selectedReasoning={runProfile.reasoning}
        onClose={() => setShowModelPicker(false)}
        onPickModel={(modelKey) => updateRunProfile(meta.id, selectedProjectPath, { modelKey })}
        onPickReasoning={(reasoning) => updateRunProfile(meta.id, selectedProjectPath, { reasoning })}
      />

      <CommandPickerModal visible={showCommandPicker} commands={commands} onClose={() => setShowCommandPicker(false)} />
    </Screen>
  );
}

function AgentPickerModal({ visible, agents, selectedAgent, onClose, onPick }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Agents" title="Choose a mode" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      {agents.length ? (
        agents.map((agent) => (
          <Panel key={agent.name}>
            <ListRow
              title={getAgentLabel(agent.name)}
              subtitle={agent.description || `${agent.mode} agent`}
              meta={<Pill active={selectedAgent === agent.name}>{agent.mode}</Pill>}
              onPress={() => onPick(agent.name)}
            />
          </Panel>
        ))
      ) : (
        <EmptyState title="No agents returned" body="The host did not expose an agent catalog for this project scope." />
      )}
    </ModalScreen>
  );
}

function ModelProfileModal({ visible, models, selectedModelKey, selectedReasoning, onClose, onPickModel, onPickReasoning }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Run Profile" title="Model and reasoning" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      <Panel>
        <Text style={styles.modalTitle}>Reasoning profile</Text>
        <View style={styles.inlineRow}>
          {reasoningProfiles.map((profile) => (
            <Pill key={profile.key} active={selectedReasoning === profile.key} onPress={() => onPickReasoning(profile.key)}>
              {profile.label}
            </Pill>
          ))}
        </View>
        <Text style={styles.supporting}>{getReasoningProfile(selectedReasoning).description}</Text>
      </Panel>
      {models.length ? (
        models.map((model) => (
          <Panel key={model.key}>
            <ListRow
              title={model.key}
              subtitle={model.providerName}
              meta={<Pill active={selectedModelKey === model.key}>Use</Pill>}
              onPress={() => onPickModel(model.key)}
            />
          </Panel>
        ))
      ) : (
        <EmptyState title="No model catalog returned" body="Check provider auth or project config on the host." />
      )}
    </ModalScreen>
  );
}

function CommandPickerModal({ visible, commands, onClose }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Commands" title="Available workflows" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      {commands.length ? (
        commands.map((command) => (
          <Panel key={command.name}>
            <ListRow title={`/${command.name}`} subtitle={command.description || command.template} meta={command.agent ? <Pill>{command.agent}</Pill> : null} />
          </Panel>
        ))
      ) : (
        <EmptyState title="No commands found" body="OpenCode exposes built-in and project commands here when available." />
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  hostMeta: { gap: spacing.sm },
  hostUrl: { color: colors.text, fontFamily: type.heading, fontSize: 18 },
  inlineRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  runMetaList: { gap: spacing.md },
  supporting: { color: colors.textMuted, fontFamily: type.body, lineHeight: 21 },
  supportingMono: { color: colors.textDim, fontFamily: type.mono, fontSize: 12, marginTop: spacing.sm },
  chipRow: { paddingTop: spacing.md, gap: spacing.sm },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(255, 244, 222, 0.06)",
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontFamily: type.body,
  },
  sessionList: { gap: spacing.md, paddingBottom: spacing.xxl },
  modalTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18, marginBottom: spacing.sm },
});
