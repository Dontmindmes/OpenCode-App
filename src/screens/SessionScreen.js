import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";

import { colors, radii, spacing, type } from "../constants/theme";
import { extractInteractionFromEvent, normalizeEventPayload } from "../lib/events";
import { compactJson, extractMessageText, formatRelativeTime, sessionTitle } from "../lib/format";
import { opencodeApi, parseSlashCommand, toModelPayload } from "../lib/opencode";
import { buildReasoningSystemPrompt, getAgentLabel, getReasoningProfile, primaryAgentsFirst, reasoningProfiles } from "../lib/profiles";
import { useCoalescedInvalidate } from "../hooks/useCoalescedInvalidate";
import { useEventStream } from "../hooks/useEventStream";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { queryClient } from "../providers/AppProviders";
import { Composer } from "../components/Composer";
import { EmptyState } from "../components/EmptyState";
import { ListRow } from "../components/ListRow";
import { MessageBubble } from "../components/MessageBubble";
import { ModalScreen } from "../components/ModalScreen";
import { Panel } from "../components/Panel";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { getRunProfile, useAppStore } from "../store/appStore";

function interactionLabel(interaction) {
  if (interaction.kind === "permission") {
    return "Permission";
  }

  if (interaction.kind === "question") {
    return "Question";
  }

  return "Action";
}

export function SessionScreen({ route, navigation }) {
  const { sessionId, projectPath } = route.params;
  const { host, meta, loading } = useSelectedHost();
  const runProfile = useAppStore((state) => getRunProfile(state, meta?.id, projectPath));
  const updateRunProfile = useAppStore((state) => state.updateRunProfile);
  const pendingInteractions = useAppStore((state) => state.pendingInteractionsBySession[sessionId] || []);
  const upsertInteraction = useAppStore((state) => state.upsertInteraction);
  const resolveInteraction = useAppStore((state) => state.resolveInteraction);
  const [draft, setDraft] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showReasoningPicker, setShowReasoningPicker] = useState(false);
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const queueInvalidate = useCoalescedInvalidate();

  const [sessionQuery, statusQuery, messagesQuery, todosQuery, agentsQuery, commandsQuery, childrenQuery, diffQuery] = useQueries({
    queries: [
      { queryKey: ["session", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.getSession(host, sessionId, projectPath || undefined), enabled: !!host, refetchInterval: 20000 },
      { queryKey: ["session-status", host?.id, projectPath || null], queryFn: () => opencodeApi.listSessionStatus(host, projectPath || undefined), enabled: !!host, refetchInterval: 10000 },
      { queryKey: ["messages", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.listMessages(host, sessionId, projectPath || undefined, 250), enabled: !!host },
      { queryKey: ["todos", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.listTodos(host, sessionId, projectPath || undefined), enabled: !!host },
      { queryKey: ["agents", host?.id, projectPath || null], queryFn: () => opencodeApi.listAgents(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["commands", host?.id, projectPath || null], queryFn: () => opencodeApi.listCommands(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["session-children", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.listSessionChildren(host, sessionId, projectPath || undefined), enabled: !!host },
      { queryKey: ["session-diff", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.getSessionDiff(host, sessionId, projectPath || undefined), enabled: !!host && showDiff },
    ],
  });

  const session = sessionQuery.data;
  const messages = useMemo(() => (Array.isArray(messagesQuery.data) ? messagesQuery.data : []), [messagesQuery.data]);
  const todos = useMemo(() => (Array.isArray(todosQuery.data) ? todosQuery.data : []), [todosQuery.data]);
  const agents = useMemo(() => primaryAgentsFirst(agentsQuery.data), [agentsQuery.data]);
  const commands = useMemo(() => (Array.isArray(commandsQuery.data) ? commandsQuery.data : []), [commandsQuery.data]);
  const children = useMemo(() => (Array.isArray(childrenQuery.data) ? childrenQuery.data : []), [childrenQuery.data]);
  const diffs = useMemo(() => (Array.isArray(diffQuery.data) ? diffQuery.data : []), [diffQuery.data]);
  const sessionStatus = statusQuery.data?.[sessionId];

  const sendMutation = useMutation({
    mutationFn: async (input) => {
      const command = parseSlashCommand(input);
      const model = toModelPayload(runProfile.modelKey);
      const system = buildReasoningSystemPrompt(runProfile.reasoning, runProfile.agent);

      if (command) {
        return opencodeApi.runCommand(
          host,
          sessionId,
          {
            command: command.command,
            arguments: command.arguments,
            agent: runProfile.agent,
            ...(model ? { model } : null),
          },
          projectPath || undefined,
        );
      }

      return opencodeApi.sendPrompt(
        host,
        sessionId,
        {
          agent: runProfile.agent,
          ...(model ? { model } : null),
          ...(system ? { system } : null),
          parts: [{ type: "text", text: input.trim() }],
        },
        projectPath || undefined,
      );
    },
    onSuccess: async () => {
      setDraft("");
      await Promise.all([messagesQuery.refetch(), sessionQuery.refetch(), todosQuery.refetch()]);
    },
    onError: (error) => Alert.alert("Could not send message", error.message),
  });

  const abortMutation = useMutation({
    mutationFn: () => opencodeApi.abortSession(host, sessionId, projectPath || undefined),
    onSuccess: async () => sessionQuery.refetch(),
    onError: (error) => Alert.alert("Could not abort run", error.message),
  });

  const permissionMutation = useMutation({
    mutationFn: ({ interactionId, response, remember }) => opencodeApi.answerPermission(host, sessionId, interactionId, response, remember, projectPath || undefined),
    onSuccess: (_, variables) => resolveInteraction(sessionId, variables.interactionId),
    onError: (error) => Alert.alert("Could not answer permission", error.message),
  });

  const renameMutation = useMutation({
    mutationFn: () => opencodeApi.renameSession(host, sessionId, renameValue.trim(), projectPath || undefined),
    onSuccess: async () => {
      setRenameValue("");
      setShowActions(false);
      await sessionQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["sessions", host?.id] });
    },
    onError: (error) => Alert.alert("Could not rename session", error.message),
  });

  const forkMutation = useMutation({
    mutationFn: () => opencodeApi.forkSession(host, sessionId, undefined, projectPath || undefined),
    onSuccess: async (childSession) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", host?.id] });
      navigation.push("Session", { sessionId: childSession.id, projectPath });
    },
    onError: (error) => Alert.alert("Could not fork session", error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => opencodeApi.deleteSession(host, sessionId, projectPath || undefined),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", host?.id] });
      navigation.goBack();
    },
    onError: (error) => Alert.alert("Could not delete session", error.message),
  });

  const summarizeMutation = useMutation({
    mutationFn: () => opencodeApi.summarizeSession(host, sessionId, toModelPayload(runProfile.modelKey), projectPath || undefined),
    onSuccess: async () => {
      await Promise.all([sessionQuery.refetch(), messagesQuery.refetch()]);
      setShowActions(false);
    },
    onError: (error) => Alert.alert("Could not summarize session", error.message),
  });

  const unrevertMutation = useMutation({
    mutationFn: () => opencodeApi.unrevertSession(host, sessionId, projectPath || undefined),
    onSuccess: async () => {
      await Promise.all([sessionQuery.refetch(), diffQuery.refetch(), messagesQuery.refetch()]);
    },
    onError: (error) => Alert.alert("Could not restore reverted changes", error.message),
  });

  const shareMutation = useMutation({
    mutationFn: () => (session?.share?.url ? opencodeApi.unshareSession(host, sessionId, projectPath || undefined) : opencodeApi.shareSession(host, sessionId, projectPath || undefined)),
    onSuccess: async () => {
      await sessionQuery.refetch();
    },
    onError: (error) => Alert.alert("Could not update share state", error.message),
  });

  useEventStream({
    host,
    projectPath: projectPath || undefined,
    enabled: !!host,
    onEvent: (payload) => {
      const normalized = normalizeEventPayload(payload);
      const interaction = extractInteractionFromEvent(normalized);

      if (interaction?.sessionId === sessionId) {
        upsertInteraction(sessionId, interaction);
      }

      if (normalized.sessionId && normalized.sessionId !== sessionId) {
        return;
      }

      if (["message.updated", "message.part.updated", "message.part.removed", "session.updated", "session.status", "session.idle", "todo.updated", "permission.replied", "permission.updated", "session.diff"].includes(normalized.type)) {
        queueInvalidate(["messages", host?.id, sessionId]);
        queueInvalidate(["session", host?.id, sessionId]);
        queueInvalidate(["todos", host?.id, sessionId]);
        queueInvalidate(["session-diff", host?.id, sessionId]);
        queueInvalidate(["session-status", host?.id, projectPath || null]);
      }
    },
  });

  if (!host) {
    return (
      <Screen>
        <SectionHeader eyebrow="Session" title={loading ? "Loading host..." : "Host unavailable"} />
        {!loading ? (
          <Panel>
            <Text style={styles.supporting}>Reconnect to the host before resuming this session.</Text>
          </Panel>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <SectionHeader eyebrow="Session" title={sessionTitle(session || { id: sessionId })} action={<PrimaryButton label="Actions" tone="subtle" onPress={() => setShowActions(true)} />} />

      <Panel>
        <View style={styles.summary}>
          <Text style={styles.summaryMeta}>{sessionId}</Text>
          <View style={styles.summaryRow}>
            <Pill tone={runProfile.agent === "plan" ? "cool" : "default"}>{getAgentLabel(runProfile.agent)}</Pill>
            <Pill>{runProfile.modelKey || "host default model"}</Pill>
            <Pill>{getReasoningProfile(runProfile.reasoning).label}</Pill>
            <Pill>{sessionStatus?.type || "idle"}</Pill>
          </View>
          <Text style={styles.supporting}>Updated {formatRelativeTime(session?.time?.updated)}</Text>
          {session?.share?.url ? <Text style={styles.shareText}>Shared: {session.share.url}</Text> : null}
          <View style={styles.inlineRow}>
            <PrimaryButton label="Agent" tone="subtle" onPress={() => setShowAgentPicker(true)} />
            <PrimaryButton label="Reasoning" tone="subtle" onPress={() => setShowReasoningPicker(true)} />
            <PrimaryButton label="Commands" tone="subtle" onPress={() => setShowCommandPicker(true)} />
            <PrimaryButton label={session?.share?.url ? "Unshare" : "Share"} tone="subtle" onPress={() => shareMutation.mutate()} />
          </View>
        </View>
      </Panel>

      {pendingInteractions.length ? (
        <Panel>
          <SectionHeader eyebrow="Pending" title="Waiting on you" />
          <View style={styles.interactionList}>
            {pendingInteractions.map((interaction) => (
              <View key={`${interaction.kind}-${interaction.id}`} style={styles.interactionCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.interactionTitle}>{interaction.title}</Text>
                  <Pill tone={interaction.kind === "permission" ? "default" : "cool"}>{interactionLabel(interaction)}</Pill>
                </View>
                <Text style={styles.supporting}>{interaction.body}</Text>
                <View style={styles.inlineRow}>
                  {interaction.kind === "permission" ? (
                    <>
                      <PrimaryButton label="Deny" tone="ghost" onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "deny", remember: false })} />
                      <PrimaryButton label="Allow once" tone="subtle" onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "allow", remember: false })} />
                      <PrimaryButton label="Allow always" onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "allow", remember: true })} />
                    </>
                  ) : (
                    interaction.options?.map((option) => (
                      <PrimaryButton
                        key={option.id}
                        label={option.label}
                        tone="subtle"
                        onPress={() => {
                          setDraft(option.value || option.label);
                          resolveInteraction(sessionId, interaction.id);
                        }}
                      />
                    ))
                  )}
                </View>
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      {todos.length ? (
        <Panel>
          <SectionHeader eyebrow="Todo" title="Working checklist" />
          <View style={styles.todoList}>
            {todos.map((todo) => (
              <View key={todo.id || todo.content} style={styles.todoRow}>
                <Pill active={todo.status === "completed"}>{todo.status || "pending"}</Pill>
                <Text style={styles.todoText}>{todo.content || todo.title}</Text>
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      {children.length ? (
        <Panel>
          <SectionHeader eyebrow="Child Sessions" title="Forked branches" />
          <View style={styles.childList}>
            {children.map((child) => (
              <ListRow key={child.id} title={sessionTitle(child)} subtitle={`Updated ${formatRelativeTime(child.time?.updated)}`} onPress={() => navigation.push("Session", { sessionId: child.id, projectPath })} />
            ))}
          </View>
        </Panel>
      ) : null}

      <View style={styles.timelineWrap}>
        <ScrollView contentContainerStyle={styles.timeline} showsVerticalScrollIndicator={false}>
          {messages.length ? (
            messages.map((message, index) => <MessageBubble key={message?.info?.id || `${sessionId}-${index}`} message={message} />)
          ) : (
            <EmptyState title="No messages yet" body="Send your first prompt, switch to plan mode, or run a slash command from the command picker." />
          )}
        </ScrollView>
      </View>

      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={() => sendMutation.mutate(draft)}
        sending={sendMutation.isPending}
        canAbort={sessionStatus?.type === "busy"}
        onAbort={() => abortMutation.mutate()}
      />

      <AgentPickerModal
        visible={showAgentPicker}
        agents={agents}
        selectedAgent={runProfile.agent}
        onClose={() => setShowAgentPicker(false)}
        onPick={(agentName) => updateRunProfile(meta.id, projectPath, { agent: agentName })}
      />

      <ReasoningPickerModal
        visible={showReasoningPicker}
        selectedReasoning={runProfile.reasoning}
        onClose={() => setShowReasoningPicker(false)}
        onPick={(reasoning) => updateRunProfile(meta.id, projectPath, { reasoning })}
      />

      <CommandPickerModal
        visible={showCommandPicker}
        commands={commands}
        onClose={() => setShowCommandPicker(false)}
        onRun={(commandText) => {
          setDraft(commandText);
          setShowCommandPicker(false);
        }}
      />

      <SessionActionsModal
        visible={showActions}
        session={session}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        onClose={() => setShowActions(false)}
        onRename={() => renameMutation.mutate()}
        onFork={() => forkMutation.mutate()}
        onSummarize={() => summarizeMutation.mutate()}
        onShowDiff={() => {
          setShowActions(false);
          setShowDiff(true);
        }}
        onUnrevert={() => unrevertMutation.mutate()}
        onShareToggle={() => shareMutation.mutate()}
        onDelete={() => deleteMutation.mutate()}
        busy={renameMutation.isPending || forkMutation.isPending || summarizeMutation.isPending || deleteMutation.isPending || unrevertMutation.isPending || shareMutation.isPending}
      />

      <DiffModal visible={showDiff} diffs={diffs} onClose={() => setShowDiff(false)} />
    </Screen>
  );
}

function AgentPickerModal({ visible, agents, selectedAgent, onClose, onPick }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Agent" title="Prompt mode" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      {agents.map((agent) => (
        <Panel key={agent.name}>
          <ListRow title={getAgentLabel(agent.name)} subtitle={agent.description || `${agent.mode} agent`} meta={<Pill active={selectedAgent === agent.name}>{agent.mode}</Pill>} onPress={() => onPick(agent.name)} />
        </Panel>
      ))}
    </ModalScreen>
  );
}

function ReasoningPickerModal({ visible, selectedReasoning, onClose, onPick }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Reasoning" title="How deliberate should the next prompt be?" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      {reasoningProfiles.map((profile) => (
        <Panel key={profile.key}>
          <ListRow title={profile.label} subtitle={profile.description} meta={<Pill active={selectedReasoning === profile.key}>Use</Pill>} onPress={() => onPick(profile.key)} />
        </Panel>
      ))}
    </ModalScreen>
  );
}

function CommandPickerModal({ visible, commands, onClose, onRun }) {
  const [argumentsValue, setArgumentsValue] = useState("");

  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Commands" title="Start with a command" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      <TextInput placeholder="Optional arguments" placeholderTextColor={colors.textDim} style={styles.input} value={argumentsValue} onChangeText={setArgumentsValue} />
      {commands.length ? (
        commands.map((command) => (
          <Panel key={command.name}>
            <ListRow
              title={`/${command.name}`}
              subtitle={command.description || command.template}
              meta={command.agent ? <Pill>{command.agent}</Pill> : null}
              onPress={() => onRun(`/${command.name}${argumentsValue.trim() ? ` ${argumentsValue.trim()}` : ""}`)}
            />
          </Panel>
        ))
      ) : (
        <EmptyState title="No commands found" body="Use slash commands directly in the composer or add project commands to OpenCode." />
      )}
    </ModalScreen>
  );
}

function SessionActionsModal({ visible, session, renameValue, setRenameValue, onClose, onRename, onFork, onSummarize, onShowDiff, onUnrevert, onShareToggle, onDelete, busy }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Session Actions" title={sessionTitle(session || { id: "session" })} action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      <Panel>
        <Text style={styles.modalTitle}>Rename</Text>
        <TextInput placeholder="New title" placeholderTextColor={colors.textDim} style={styles.input} value={renameValue} onChangeText={setRenameValue} />
        <PrimaryButton label="Rename session" tone="subtle" onPress={onRename} disabled={busy || !renameValue.trim()} />
      </Panel>
      <Panel>
        <View style={styles.actionList}>
          <PrimaryButton label="Fork session" tone="subtle" onPress={onFork} disabled={busy} />
          <PrimaryButton label="Summarize session" tone="subtle" onPress={onSummarize} disabled={busy} />
          <PrimaryButton label={session?.share?.url ? "Unshare session" : "Share session"} tone="subtle" onPress={onShareToggle} disabled={busy} />
          <PrimaryButton label="View diff" tone="subtle" onPress={onShowDiff} disabled={busy} />
          {session?.revert ? <PrimaryButton label="Restore reverted work" tone="subtle" onPress={onUnrevert} disabled={busy} /> : null}
          <PrimaryButton label="Delete session" tone="danger" onPress={onDelete} disabled={busy} />
        </View>
      </Panel>
    </ModalScreen>
  );
}

function DiffModal({ visible, diffs, onClose }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <SectionHeader eyebrow="Diff" title="Session changes" action={<PrimaryButton label="Done" tone="ghost" onPress={onClose} />} />
      {diffs.length ? (
        diffs.map((diff) => (
          <Panel key={diff.file}>
            <Text style={styles.diffTitle}>{diff.file}</Text>
            <View style={styles.summaryRow}>
              <Pill>+{diff.additions}</Pill>
              <Pill>-{diff.deletions}</Pill>
            </View>
            <Text style={styles.supporting}>{compactJson({ before: diff.before, after: diff.after })}</Text>
          </Panel>
        ))
      ) : (
        <EmptyState title="No diff yet" body="This session has not produced a file diff or the host has not emitted one yet." />
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, paddingBottom: spacing.md },
  summary: { gap: spacing.sm },
  summaryMeta: { color: colors.textDim, fontFamily: type.mono, fontSize: 12 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  inlineRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  supporting: { color: colors.textMuted, fontFamily: type.body, lineHeight: 20 },
  shareText: { color: colors.accentStrong, fontFamily: type.mono, fontSize: 12 },
  interactionList: { gap: spacing.md },
  interactionCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.md, backgroundColor: "rgba(255, 244, 222, 0.04)" },
  interactionTitle: { color: colors.text, fontFamily: type.heading, fontSize: 17, flex: 1 },
  todoList: { gap: spacing.sm },
  todoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  todoText: { flex: 1, color: colors.text, fontFamily: type.body, lineHeight: 21 },
  childList: { gap: spacing.sm },
  timelineWrap: { flex: 1, minHeight: 0, paddingTop: spacing.md },
  timeline: { gap: spacing.md, paddingBottom: spacing.xl },
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
  modalTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18, marginBottom: spacing.sm },
  actionList: { gap: spacing.sm },
  diffTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18, marginBottom: spacing.sm },
});
