import { useMemo } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { colors, radii, spacing, type } from "../constants/theme";
import { formatRelativeTime, normalizeProject, sessionTitle, truncateMiddle } from "../lib/format";
import { opencodeApi } from "../lib/opencode";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { EmptyState } from "../components/EmptyState";
import { Pill } from "../components/Pill";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { getProjectScope, useAppStore } from "../store/appStore";

function sortSessions(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left?.time?.updated || left?.time?.created || 0).getTime();
    const rightTime = new Date(right?.time?.updated || right?.time?.created || 0).getTime();
    return rightTime - leftTime;
  });
}

function IconButton({ icon, onPress, accessibilityLabel }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.iconButton}>
      <Feather name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

export function WorkspaceScreen({ navigation }) {
  const { host, meta, loading } = useSelectedHost();
  const selectedProjectByHost = useAppStore((state) => state.selectedProjectByHost);
  const selectedSessionByScope = useAppStore((state) => state.selectedSessionByScope);
  const selectProject = useAppStore((state) => state.selectProject);
  const selectSession = useAppStore((state) => state.selectSession);

  const [healthQuery, projectsQuery, currentProjectQuery, recentSessionsQuery] = useQueries({
    queries: [
      { queryKey: ["health", host?.id], queryFn: () => opencodeApi.health(host), enabled: !!host },
      { queryKey: ["projects", host?.id], queryFn: () => opencodeApi.listProjects(host), enabled: !!host },
      { queryKey: ["project-current", host?.id], queryFn: () => opencodeApi.currentProject(host), enabled: !!host },
      { queryKey: ["recent-sessions", host?.id], queryFn: () => opencodeApi.listSessions(host), enabled: !!host },
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

  const selectedProjectPath = selectedProjectByHost[meta?.id || ""] || projects[0]?.path || currentProjectQuery.data?.directory || null;
  const recentSessions = useMemo(() => sortSessions(Array.isArray(recentSessionsQuery.data) ? recentSessionsQuery.data : []).slice(0, 6), [recentSessionsQuery.data]);

  const openWorkspaceMutation = useMutation({
    mutationFn: async (projectPath) => {
      const sessionData = await opencodeApi.listSessions(host, projectPath || undefined);
      const sessions = sortSessions(Array.isArray(sessionData) ? sessionData : []);
      const scope = getProjectScope(meta?.id, projectPath);
      const rememberedId = selectedSessionByScope[scope];
      const rememberedSession = sessions.find((session) => session.id === rememberedId) || sessions[0] || null;

      if (rememberedSession) {
        return { projectPath, session: rememberedSession };
      }

      const session = await opencodeApi.createSession(host, {}, projectPath || undefined);
      return { projectPath, session };
    },
    onSuccess: async ({ projectPath, session }) => {
      await selectProject(meta.id, projectPath || null);
      await selectSession(meta.id, projectPath || null, session.id);
      navigation.replace("Session", { sessionId: session.id, projectPath: projectPath || null });
    },
    onError: (error) => Alert.alert("Could not open workspace", error.message),
  });

  const newChatMutation = useMutation({
    mutationFn: async (projectPath) => {
      const session = await opencodeApi.createSession(host, {}, projectPath || undefined);
      return { projectPath, session };
    },
    onSuccess: async ({ projectPath, session }) => {
      await selectProject(meta.id, projectPath || null);
      await selectSession(meta.id, projectPath || null, session.id);
      navigation.replace("Session", { sessionId: session.id, projectPath: projectPath || null });
    },
    onError: (error) => Alert.alert("Could not start chat", error.message),
  });

  const refreshAll = async () => {
    await Promise.all([healthQuery.refetch(), projectsQuery.refetch(), currentProjectQuery.refetch(), recentSessionsQuery.refetch()]);
  };

  if (!host) {
    return (
      <Screen scroll={false} contentStyle={styles.screenContent}>
        <View style={styles.headerRow}>
          <IconButton icon="chevron-left" onPress={() => navigation.replace("Connect")} accessibilityLabel="Back to connect" />
          <Text style={styles.headerTitle}>{loading ? "Loading..." : "No Server"}</Text>
          <View style={styles.headerSpacer} />
        </View>
        {!loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No server selected</Text>
            <Text style={styles.emptyBody}>Choose a saved server or enter a new one to continue.</Text>
            <PrimaryButton label="Go to Connect" onPress={() => navigation.replace("Connect")} />
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.headerRow}>
        <IconButton icon="chevron-left" onPress={() => navigation.replace("Connect")} accessibilityLabel="Back to connect" />
        <Text style={styles.headerTitle}>Workspace</Text>
        <IconButton icon="server" onPress={() => navigation.replace("Connect")} accessibilityLabel="Server settings" />
      </View>

      <ScrollView
        refreshControl={<RefreshControl tintColor={colors.accent} refreshing={projectsQuery.isRefetching || recentSessionsQuery.isRefetching} onRefresh={refreshAll} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.serverCard}>
          <View style={styles.serverHeader}>
            <Text style={styles.serverName}>{meta?.name || "OpenCode Server"}</Text>
            <Pill tone="cool">{healthQuery.data?.healthy ? `Online` : "Connecting..."}</Pill>
          </View>
          <Text style={styles.serverUrl}>{truncateMiddle(host.baseUrl, 40, 24)}</Text>
          {selectedProjectPath ? (
            <View style={styles.selectedFolder}>
              <Feather name="folder" size={14} color={colors.textMuted} />
              <Text style={styles.selectedFolderText}>{truncateMiddle(selectedProjectPath, 32, 20)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Folders</Text>
            {selectedProjectPath && (
              <Pressable style={styles.newChatPill} onPress={() => newChatMutation.mutate(selectedProjectPath)}>
                <Feather name="plus" size={14} color={colors.text} />
                <Text style={styles.newChatPillText}>New chat</Text>
              </Pressable>
            )}
          </View>
          {projects.length ? (
            <View style={styles.cardList}>
              {projects.map((project) => {
                const isSelected = project.path === selectedProjectPath;
                return (
                  <Pressable
                    key={project.path}
                    style={[styles.projectCard, isSelected && styles.projectCardSelected]}
                    onPress={() => openWorkspaceMutation.mutate(project.path)}
                  >
                    <View style={styles.projectIcon}>
                      <Feather name="folder" size={18} color={isSelected ? colors.accent : colors.textMuted} />
                    </View>
                    <View style={styles.projectContent}>
                      <Text style={styles.projectName}>{project.name || project.path}</Text>
                      <Text style={styles.projectPath}>{project.path}</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Feather name="check" size={14} color={colors.surface} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No folders</Text>
              <Text style={styles.emptyBody}>Make sure your server can report projects.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Chats</Text>
          {recentSessions.length ? (
            <View style={styles.cardList}>
              {recentSessions.map((session) => (
                <Pressable
                  key={session.id}
                  style={styles.sessionCard}
                  onPress={async () => {
                    const projectPath = session.project?.path || session.projectPath || session.directory || selectedProjectPath || null;
                    await selectProject(meta.id, projectPath);
                    await selectSession(meta.id, projectPath, session.id);
                    navigation.replace("Session", { sessionId: session.id, projectPath });
                  }}
                >
                  <View style={styles.sessionIcon}>
                    <Feather name="message-circle" size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.sessionContent}>
                    <Text style={styles.sessionTitle}>{sessionTitle(session)}</Text>
                    <Text style={styles.sessionMeta}>Updated {formatRelativeTime(session.time?.updated)}</Text>
                  </View>
                  <Text style={styles.sessionId}>{session.id.slice(0, 6)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptyBody}>Select a folder above to start chatting.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 46,
    gap: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 17,
    lineHeight: 20,
  },
  headerSpacer: {
    width: 38,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  serverCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  serverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serverName: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 18,
    lineHeight: 22,
  },
  serverUrl: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  selectedFolder: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  selectedFolderText: {
    color: colors.textMuted,
    fontFamily: type.mono,
    fontSize: 12,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.textDim,
    fontFamily: type.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  newChatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newChatPillText: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 12,
  },
  cardList: {
    gap: spacing.sm,
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  projectCardSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderColor: colors.accent,
  },
  projectIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  projectContent: {
    flex: 1,
    gap: 2,
  },
  projectName: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 15,
  },
  projectPath: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionContent: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 15,
  },
  sessionMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  sessionId: {
    color: colors.textDim,
    fontFamily: type.mono,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 16,
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    textAlign: "center",
  },
});
