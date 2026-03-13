import { useMemo, useState, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { colors, radii, spacing, type } from "../constants/theme";
import { extractInteractionFromEvent, normalizeEventPayload } from "../lib/events";
import { compactJson, flattenModels, formatRelativeTime, sessionTitle, truncateMiddle } from "../lib/format";
import { opencodeApi, parseSlashCommand, toModelPayload } from "../lib/opencode";
import { buildReasoningSystemPrompt, getAgentLabel, getReasoningProfile, primaryAgentsFirst, reasoningProfiles } from "../lib/profiles";
import { useCoalescedInvalidate } from "../hooks/useCoalescedInvalidate";
import { useEventStream } from "../hooks/useEventStream";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { queryClient } from "../providers/AppProviders";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { ModalScreen } from "../components/ModalScreen";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
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

const emptyInteractions = [];

export function SessionScreen({ route, navigation }) {
  const { sessionId, projectPath } = route.params;
  const { host, meta, loading } = useSelectedHost();
  const hostId = meta?.id;
  const runProfile = useAppStore((state) => getRunProfile(state, hostId, projectPath));
  const updateRunProfile = useAppStore((state) => state.updateRunProfile);
  const pendingInteractions = useAppStore((state) => state.pendingInteractionsBySession[sessionId] || emptyInteractions);
  const upsertInteraction = useAppStore((state) => state.upsertInteraction);
  const resolveInteraction = useAppStore((state) => state.resolveInteraction);
  const [draft, setDraft] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [activeInlinePicker, setActiveInlinePicker] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [questionInteraction, setQuestionInteraction] = useState(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const queueInvalidate = useCoalescedInvalidate();

  const handleScroll = (event) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY > 10) {
      if (currentY > lastScrollY.current) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }
    } else {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };

  const [sessionQuery, statusQuery, messagesQuery, todosQuery, agentsQuery, commandsQuery, diffQuery, configProvidersQuery, configQuery, vcsQuery] = useQueries({
    queries: [
      { queryKey: ["session", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.getSession(host, sessionId, projectPath || undefined), enabled: !!host, refetchInterval: 20000 },
      { queryKey: ["session-status", host?.id, projectPath || null], queryFn: () => opencodeApi.listSessionStatus(host, projectPath || undefined), enabled: !!host, refetchInterval: 10000 },
      { queryKey: ["messages", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.listMessages(host, sessionId, projectPath || undefined, 250), enabled: !!host },
      { queryKey: ["todos", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.listTodos(host, sessionId, projectPath || undefined), enabled: !!host },
      { queryKey: ["agents", host?.id, projectPath || null], queryFn: () => opencodeApi.listAgents(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["commands", host?.id, projectPath || null], queryFn: () => opencodeApi.listCommands(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["session-diff", host?.id, sessionId, projectPath || null], queryFn: () => opencodeApi.getSessionDiff(host, sessionId, projectPath || undefined), enabled: !!host && showDiff },
      { queryKey: ["config-providers", host?.id, projectPath || null], queryFn: () => opencodeApi.getConfigProviders(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["config", host?.id, projectPath || null], queryFn: () => opencodeApi.getConfig(host, projectPath || undefined), enabled: !!host },
      { queryKey: ["vcs", host?.id, projectPath || null], queryFn: () => opencodeApi.getVcs(host, projectPath || undefined), enabled: !!host },
    ],
  });

  const session = sessionQuery.data;
  const messages = useMemo(() => (Array.isArray(messagesQuery.data) ? messagesQuery.data : []), [messagesQuery.data]);
  const agents = useMemo(() => primaryAgentsFirst(agentsQuery.data), [agentsQuery.data]);
  const commands = useMemo(() => (Array.isArray(commandsQuery.data) ? commandsQuery.data : []), [commandsQuery.data]);
  const models = useMemo(() => flattenModels(configProvidersQuery.data), [configProvidersQuery.data]);
  const diffs = useMemo(() => (Array.isArray(diffQuery.data) ? diffQuery.data : []), [diffQuery.data]);
  const sessionStatus = statusQuery.data?.[sessionId];
  const selectedModelKey = runProfile.modelKey || configQuery.data?.model || null;
  const sessionMeta = [projectPath || null, sessionStatus?.type || null, formatRelativeTime(session?.time?.updated)].filter(Boolean).join("  ·  ");

  const sendMutation = useMutation({
    mutationFn: async (input) => {
      const command = parseSlashCommand(input);
      const model = toModelPayload(selectedModelKey);
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
    onError: (error) => {
      setDraft("");
      Alert.alert("Could not send message", error.message);
    },
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

  const questionMutation = useMutation({
    mutationFn: ({ interactionId, answer }) => opencodeApi.answerQuestion(host, sessionId, interactionId, answer, projectPath || undefined),
    onSuccess: async (_, variables) => {
      setDraft("");
      resolveInteraction(sessionId, variables.interactionId);
      await Promise.all([messagesQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => {
      setDraft("");
      Alert.alert("Could not answer question", error.message);
    },
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
    mutationFn: () => opencodeApi.summarizeSession(host, sessionId, toModelPayload(selectedModelKey), projectPath || undefined),
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

      if (["message.updated", "message.part.updated", "message.part.removed", "session.updated", "session.status", "session.idle", "todo.updated", "permission.replied", "permission.updated", "session.diff", "question.replied", "question.updated"].includes(normalized.type)) {
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
        <View style={styles.headerRow}>
          <IconButton icon="chevron-left" onPress={() => navigation.replace("Workspace")} accessibilityLabel="Back to workspace" />
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{loading ? "Loading..." : "Host unavailable"}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Reconnect to host</Text>
          <Text style={styles.emptyBody}>Reconnect to the host before resuming this session.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      {headerVisible && (
        <View style={styles.headerRow}>
          <IconButton icon="chevron-left" onPress={() => navigation.replace("Workspace")} accessibilityLabel="Back to workspace" />
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>{sessionTitle(session || { id: sessionId })}</Text>
            {sessionMeta ? <Text style={styles.sessionMeta} numberOfLines={1}>{sessionMeta}</Text> : null}
          </View>
          <IconButton icon="more-horizontal" onPress={() => setShowActions(true)} accessibilityLabel="Session actions" />
        </View>
      )}

      {pendingInteractions.length ? (
        <View style={styles.pendingCard}>
          <View style={styles.pendingHeader}>
            <Text style={styles.pendingTitle}>Reply to continue</Text>
          </View>
          {pendingInteractions.map((interaction) => (
            <View key={`${interaction.kind}-${interaction.id}`} style={styles.interactionContent}>
              <Text style={styles.interactionTitle}>{interaction.title}</Text>
              <Text style={styles.interactionBody}>{interaction.body}</Text>
              <View style={styles.interactionActions}>
                {interaction.kind === "permission" ? (
                  <>
                    <Pressable style={styles.interactionButton} onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "deny", remember: false })}>
                      <Text style={styles.interactionButtonText}>Deny</Text>
                    </Pressable>
                    <Pressable style={[styles.interactionButton, styles.interactionButtonSubtle]} onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "allow", remember: false })}>
                      <Text style={styles.interactionButtonTextSubtle}>Allow once</Text>
                    </Pressable>
                    <Pressable style={styles.interactionButtonPrimary} onPress={() => permissionMutation.mutate({ interactionId: interaction.id, response: "allow", remember: true })}>
                      <Text style={styles.interactionButtonTextPrimary}>Allow always</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {interaction.options?.map((option) => (
                      <Pressable key={option.id} style={[styles.interactionButton, styles.interactionButtonSubtle]} onPress={() => questionMutation.mutate({ interactionId: interaction.id, answer: option.value || option.label })}>
                        <Text style={styles.interactionButtonTextSubtle}>{option.label}</Text>
                      </Pressable>
                    ))}
                    <Pressable style={[styles.interactionButton, styles.interactionButtonSubtle]} onPress={() => {
                      setDraft("");
                      setActiveInlinePicker("question:" + interaction.id);
                      setQuestionInteraction(interaction);
                    }}>
                      <Text style={styles.interactionButtonTextSubtle}>Custom...</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.timelineWrap}>
        <ScrollView 
          onScroll={handleScroll} 
          scrollEventThrottle={16}
          contentContainerStyle={styles.timeline} 
          showsVerticalScrollIndicator={false}
        >
          {messages.length ? (
            messages.map((message, index) => <MessageBubble key={message?.info?.id || `${sessionId}-${index}`} message={message} />)
          ) : (
            <View style={styles.emptyTimeline}>
              <Text style={styles.emptyTimelineTitle}>No messages yet</Text>
              <Text style={styles.emptyTimelineBody}>Send your first prompt to get started.</Text>
            </View>
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
        modelLabel={selectedModelKey || "Host default"}
        reasoningLabel={getReasoningProfile(runProfile.reasoning).label}
        modeLabel={getAgentLabel(runProfile.agent)}
        onOpenCommands={() => setActiveInlinePicker("commands")}
        onOpenModel={() => setActiveInlinePicker("model")}
        onOpenReasoning={() => setActiveInlinePicker("reasoning")}
        onOpenMode={() => setActiveInlinePicker("agent")}
        onOpenWorkspace={() => navigation.replace("Workspace")}
        workspaceLabel={truncateMiddle(projectPath || "Workspace", 10, 8)}
        statusLabel={getReasoningProfile(runProfile.reasoning).label}
        branchLabel={vcsQuery.data?.branch || "Commands"}
      />

      <InlinePickerOverlay visible={!!activeInlinePicker} onClose={() => setActiveInlinePicker(null)}>
        {activeInlinePicker === "agent" ? (
          <AgentPickerCard
            agents={agents}
            selectedAgent={runProfile.agent}
            onPick={(agentName) => {
              updateRunProfile(hostId, projectPath, { agent: agentName });
              setActiveInlinePicker(null);
            }}
          />
        ) : null}
        {activeInlinePicker === "model" ? (
          <ModelPickerCard
            models={models}
            selectedModelKey={selectedModelKey}
            onPick={(modelKey) => {
              updateRunProfile(hostId, projectPath, { modelKey });
              setActiveInlinePicker(null);
            }}
          />
        ) : null}
        {activeInlinePicker === "reasoning" ? (
          <ReasoningPickerCard
            selectedReasoning={runProfile.reasoning}
            onPick={(reasoning) => {
              updateRunProfile(hostId, projectPath, { reasoning });
              setActiveInlinePicker(null);
            }}
          />
        ) : null}
        {activeInlinePicker === "commands" ? (
          <CommandPickerCard
            commands={commands}
            onRun={(commandText) => {
              setDraft(commandText);
              setActiveInlinePicker(null);
            }}
          />
        ) : null}
        {activeInlinePicker?.startsWith("question:") ? (
          <CustomAnswerCard
            question={questionInteraction}
            value={customAnswer}
            onChangeText={setCustomAnswer}
            onSend={() => {
              if (customAnswer.trim()) {
                questionMutation.mutate({ interactionId: questionInteraction?.id, answer: customAnswer.trim() });
                setActiveInlinePicker(null);
                setCustomAnswer("");
                setQuestionInteraction(null);
              }
            }}
            onClose={() => {
              setActiveInlinePicker(null);
              setCustomAnswer("");
              setQuestionInteraction(null);
            }}
          />
        ) : null}
      </InlinePickerOverlay>

      <SessionActionsModal
        visible={showActions}
        session={session}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        onClose={() => setShowActions(false)}
        onRename={() => renameMutation.mutate()}
        onFork={() => forkMutation.mutate()}
        onSummarize={() => summarizeMutation.mutate()}
        onOpenAgentPicker={() => {
          setShowActions(false);
          setActiveInlinePicker("agent");
        }}
        onOpenModelPicker={() => {
          setShowActions(false);
          setActiveInlinePicker("model");
        }}
        onOpenReasoningPicker={() => {
          setShowActions(false);
          setActiveInlinePicker("reasoning");
        }}
        onOpenCommandPicker={() => {
          setShowActions(false);
          setActiveInlinePicker("commands");
        }}
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

function InlinePickerOverlay({ visible, onClose, children }) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.inlinePickerWrap} pointerEvents="box-none">
      <Pressable style={styles.inlinePickerBackdrop} onPress={onClose} />
      {children}
    </View>
  );
}

function AgentPickerCard({ agents, selectedAgent, onPick }) {
  return (
    <InlinePickerCard title="Select mode">
      {agents.map((agent) => (
        <InlinePickerRow key={agent.name} label={getAgentLabel(agent.name)} selected={selectedAgent === agent.name} subtitle={agent.description || `${agent.mode} agent`} onPress={() => onPick(agent.name)} />
      ))}
    </InlinePickerCard>
  );
}

function ModelPickerCard({ models, selectedModelKey, onPick }) {
  return (
    <InlinePickerCard title="Select model">
      {models.length ? (
        models.map((model) => (
          <InlinePickerRow key={model.key} label={model.label || model.key} subtitle={model.providerName} selected={selectedModelKey === model.key} onPress={() => onPick(model.key)} />
        ))
      ) : (
        <View style={styles.emptyPicker}><Text style={styles.emptyPickerText}>No models found</Text></View>
      )}
    </InlinePickerCard>
  );
}

function ReasoningPickerCard({ selectedReasoning, onPick }) {
  return (
    <InlinePickerCard title="Thinking difficulty">
      {reasoningProfiles.map((profile) => (
        <InlinePickerRow key={profile.key} label={profile.label} subtitle={profile.description} selected={selectedReasoning === profile.key} onPress={() => onPick(profile.key)} />
      ))}
    </InlinePickerCard>
  );
}

function CommandPickerCard({ commands, onRun }) {
  const [argumentsValue, setArgumentsValue] = useState("");

  return (
    <InlinePickerCard title="Start with a command">
      <TextInput placeholder="Optional arguments" placeholderTextColor={colors.textDim} style={styles.pickerInput} value={argumentsValue} onChangeText={setArgumentsValue} />
      {commands.length ? (
        commands.map((command) => (
          <InlinePickerRow key={command.name} label={`/${command.name}`} subtitle={command.description || command.template} trailing={command.agent ? command.agent : null} onPress={() => onRun(`/${command.name}${argumentsValue.trim() ? ` ${argumentsValue.trim()}` : ""}`)} />
        ))
      ) : (
        <View style={styles.emptyPicker}><Text style={styles.emptyPickerText}>No commands found</Text></View>
      )}
    </InlinePickerCard>
  );
}

function CustomAnswerCard({ question, value, onChangeText, onSend, onClose }) {
  return (
    <InlinePickerCard title={question?.title || "Enter your answer"}>
      <TextInput
        placeholder="Type your answer..."
        placeholderTextColor={colors.textDim}
        style={styles.customAnswerInput}
        value={value}
        onChangeText={onChangeText}
        autoFocus
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      <View style={styles.customAnswerActions}>
        <PrimaryButton label="Cancel" tone="ghost" onPress={onClose} />
        <PrimaryButton label="Send" onPress={onSend} disabled={!value.trim()} />
      </View>
    </InlinePickerCard>
  );
}

function InlinePickerCard({ title, children }) {
  return (
    <View style={styles.inlinePickerCard}>
      <Text style={styles.inlinePickerTitle}>{title}</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inlinePickerContent}>
        {children}
      </ScrollView>
    </View>
  );
}

function InlinePickerRow({ label, subtitle, selected, onPress, trailing }) {
  return (
    <Pressable onPress={onPress} style={styles.inlinePickerRow}>
      <View style={styles.inlinePickerCopy}>
        <Text style={styles.inlinePickerLabel}>{label}</Text>
        {subtitle ? <Text style={styles.inlinePickerSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.inlinePickerRight}>
        {trailing ? <Text style={styles.inlinePickerTrailing}>{trailing}</Text> : null}
        {selected ? <Feather name="check" size={16} color={colors.text} /> : null}
      </View>
    </Pressable>
  );
}

function IconButton({ icon, onPress, accessibilityLabel }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.iconButton}>
      <Feather name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function SessionActionsModal({
  visible,
  session,
  renameValue,
  setRenameValue,
  onClose,
  onRename,
  onFork,
  onSummarize,
  onOpenAgentPicker,
  onOpenModelPicker,
  onOpenReasoningPicker,
  onOpenCommandPicker,
  onShowDiff,
  onUnrevert,
  onShareToggle,
  onDelete,
  busy,
}) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{sessionTitle(session || { id: "session" })}</Text>
        <Pressable onPress={onClose}><Feather name="x" size={20} color={colors.text} /></Pressable>
      </View>
      <View style={styles.modalSection}>
        <TextInput placeholder="New title" placeholderTextColor={colors.textDim} style={styles.modalInput} value={renameValue} onChangeText={setRenameValue} />
        <PrimaryButton label="Rename" tone="subtle" onPress={onRename} disabled={busy || !renameValue.trim()} />
      </View>
      <View style={styles.modalActions}>
        <ModalAction label="Change mode" onPress={onOpenAgentPicker} disabled={busy} />
        <ModalAction label="Change model" onPress={onOpenModelPicker} disabled={busy} />
        <ModalAction label="Change reasoning" onPress={onOpenReasoningPicker} disabled={busy} />
        <ModalAction label="Insert command" onPress={onOpenCommandPicker} disabled={busy} />
        <ModalAction label="Fork session" onPress={onFork} disabled={busy} />
        <ModalAction label="Summarize session" onPress={onSummarize} disabled={busy} />
        <ModalAction label={session?.share?.url ? "Unshare session" : "Share session"} onPress={onShareToggle} disabled={busy} />
        <ModalAction label="View diff" onPress={onShowDiff} disabled={busy} />
        {session?.revert ? <ModalAction label="Restore reverted work" onPress={onUnrevert} disabled={busy} /> : null}
        <ModalAction label="Delete session" onPress={onDelete} disabled={busy} danger />
      </View>
    </ModalScreen>
  );
}

function ModalAction({ label, onPress, disabled, danger }) {
  return (
    <Pressable style={styles.modalAction} onPress={onPress} disabled={disabled}>
      <Text style={[styles.modalActionText, danger && styles.modalActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function DiffModal({ visible, diffs, onClose }) {
  return (
    <ModalScreen visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Session changes</Text>
        <Pressable onPress={onClose}><Feather name="x" size={20} color={colors.text} /></Pressable>
      </View>
      {diffs.length ? (
        diffs.map((diff) => (
          <View key={diff.file} style={styles.diffCard}>
            <Text style={styles.diffFile}>{diff.file}</Text>
            <View style={styles.diffStats}>
              <Pill>+{diff.additions}</Pill>
              <Pill>-{diff.deletions}</Pill>
            </View>
            <Text style={styles.diffBody}>{compactJson({ before: diff.before, after: diff.after })}</Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyTimeline}>
          <Text style={styles.emptyTimelineTitle}>No diff yet</Text>
          <Text style={styles.emptyTimelineBody}>This session has not produced a file diff.</Text>
        </View>
      )}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, paddingBottom: spacing.xs },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 48,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 16,
    lineHeight: 20,
  },
  sessionMeta: { color: colors.textDim, fontFamily: type.mono, fontSize: 10, lineHeight: 12 },
  headerSpacer: { width: 38 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    margin: spacing.lg,
  },
  emptyTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18 },
  emptyBody: { color: colors.textMuted, fontFamily: type.body, fontSize: 14, textAlign: "center" },
  pendingCard: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pendingHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  pendingTitle: { color: colors.text, fontFamily: type.mono, fontSize: 14 },
  interactionContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  interactionTitle: { color: colors.text, fontFamily: type.heading, fontSize: 15 },
  interactionBody: { color: colors.textMuted, fontFamily: type.body, fontSize: 13, lineHeight: 18 },
  interactionActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  interactionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interactionButtonSubtle: { backgroundColor: "transparent" },
  interactionButtonPrimary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  interactionButtonText: { color: colors.text, fontFamily: type.mono, fontSize: 12 },
  interactionButtonTextSubtle: { color: colors.textMuted, fontFamily: type.mono, fontSize: 12 },
  interactionButtonTextPrimary: { color: "#ffffff", fontFamily: type.mono, fontSize: 12 },
  timelineWrap: { flex: 1, minHeight: 0, paddingTop: spacing.sm },
  timeline: { gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.xs },
  emptyTimeline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.xs,
  },
  emptyTimelineTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18 },
  emptyTimelineBody: { color: colors.textMuted, fontFamily: type.body, fontSize: 14 },
  inlinePickerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingBottom: 160,
    zIndex: 30,
  },
  inlinePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  inlinePickerCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 380,
    maxHeight: 340,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inlinePickerTitle: {
    color: colors.textDim,
    fontFamily: type.body,
    fontSize: 13,
    textAlign: "center",
    paddingBottom: spacing.sm,
  },
  inlinePickerContent: { gap: spacing.xs, paddingBottom: spacing.sm },
  inlinePickerRow: {
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  inlinePickerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inlinePickerCopy: { flex: 1, gap: 2 },
  inlinePickerLabel: { color: colors.text, fontFamily: type.mono, fontSize: 14, lineHeight: 18 },
  inlinePickerSubtitle: { color: colors.textMuted, fontFamily: type.body, fontSize: 12, lineHeight: 16 },
  inlinePickerTrailing: { color: colors.textDim, fontFamily: type.mono, fontSize: 11 },
  pickerInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    fontFamily: type.mono,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  customAnswerInput: {
    minHeight: 80,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: type.mono,
    fontSize: 14,
    marginBottom: spacing.sm,
    textAlignVertical: "top",
  },
  customAnswerActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  customAnswerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  customAnswerButtonPrimary: { backgroundColor: colors.ink },
  customAnswerButtonDisabled: { opacity: 0.3 },
  customAnswerButtonText: { color: colors.text, fontFamily: type.mono, fontSize: 13 },
  customAnswerButtonTextPrimary: { color: "#ffffff", fontFamily: type.mono, fontSize: 13 },
  emptyPicker: { padding: spacing.lg, alignItems: "center" },
  emptyPickerText: { color: colors.textMuted, fontFamily: type.body, fontSize: 13 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  modalTitle: { color: colors.text, fontFamily: type.heading, fontSize: 18 },
  modalSection: { gap: spacing.sm, marginBottom: spacing.md },
  modalInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    fontFamily: type.mono,
    fontSize: 14,
  },
  modalActions: { gap: spacing.xs },
  modalAction: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  modalActionText: { color: colors.text, fontFamily: type.body, fontSize: 15 },
  modalActionTextDanger: { color: colors.danger },
  diffCard: {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  diffFile: { color: colors.text, fontFamily: type.mono, fontSize: 13 },
  diffStats: { flexDirection: "row", gap: spacing.sm },
  diffBody: { color: colors.textMuted, fontFamily: type.mono, fontSize: 11, lineHeight: 16 },
});
