import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueries, useQuery } from "@tanstack/react-query";

import { colors, radii, spacing, type } from "../constants/theme";
import { opencodeApi } from "../lib/opencode";
import { useSelectedHost } from "../hooks/useSelectedHost";
import { EmptyState } from "../components/EmptyState";
import { ListRow } from "../components/ListRow";
import { Panel } from "../components/Panel";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { useAppStore } from "../store/appStore";

export function WorkspaceToolsScreen() {
  const { host, meta } = useSelectedHost();
  const selectedProjectByHost = useAppStore((state) => state.selectedProjectByHost);
  const projectPath = selectedProjectByHost[meta?.id || ""] || undefined;
  const [fileQuery, setFileQuery] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [statusQuery, fileSearchQuery, textSearchQuery] = useQueries({
    queries: [
      { queryKey: ["workspace-status", host?.id, projectPath || null], queryFn: () => opencodeApi.getFileStatus(host, projectPath), enabled: !!host },
      { queryKey: ["workspace-file-search", host?.id, projectPath || null, fileQuery], queryFn: () => opencodeApi.searchFiles(host, fileQuery, projectPath), enabled: !!host && fileQuery.trim().length >= 2 },
      { queryKey: ["workspace-text-search", host?.id, projectPath || null, textQuery], queryFn: () => opencodeApi.searchText(host, textQuery, projectPath), enabled: !!host && textQuery.trim().length >= 2 },
    ],
  });

  const fileContentQuery = useQuery({
    queryKey: ["workspace-file-content", host?.id, projectPath || null, selectedFile],
    queryFn: () => opencodeApi.readFile(host, selectedFile, projectPath),
    enabled: !!host && !!selectedFile,
  });

  const changedFiles = useMemo(() => (Array.isArray(statusQuery.data) ? statusQuery.data : []), [statusQuery.data]);
  const fileResults = useMemo(() => (Array.isArray(fileSearchQuery.data) ? fileSearchQuery.data : []), [fileSearchQuery.data]);
  const textResults = useMemo(() => (Array.isArray(textSearchQuery.data) ? textSearchQuery.data : []), [textSearchQuery.data]);

  return (
    <Screen>
      <SectionHeader eyebrow="Workspace Tools" title="Files and changes" />

      <Panel>
        <SectionHeader eyebrow="Changed Files" title="Project status" />
        {changedFiles.length ? (
          <View style={styles.list}>
            {changedFiles.map((file) => (
              <ListRow
                key={file.path}
                title={file.path}
                subtitle={`${file.status} · +${file.added} -${file.removed}`}
                onPress={() => setSelectedFile(file.path)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No tracked changes" body="The host did not report modified tracked files for this project." />
        )}
      </Panel>

      <Panel>
        <SectionHeader eyebrow="File Search" title="Open a file" />
        <TextInput value={fileQuery} onChangeText={setFileQuery} placeholder="Search file names" placeholderTextColor={colors.textDim} style={styles.input} />
        {fileQuery.trim().length < 2 ? (
          <Text style={styles.supporting}>Type at least 2 characters to search files.</Text>
        ) : fileResults.length ? (
          <View style={styles.list}>
            {fileResults.map((filePath) => (
              <ListRow key={filePath} title={filePath} onPress={() => setSelectedFile(filePath)} />
            ))}
          </View>
        ) : (
          <EmptyState title="No files found" body="Try another search term or browse the changed files list above." />
        )}
      </Panel>

      <Panel>
        <SectionHeader eyebrow="Text Search" title="Search contents" />
        <TextInput value={textQuery} onChangeText={setTextQuery} placeholder="Search text or regex" placeholderTextColor={colors.textDim} style={styles.input} />
        {textQuery.trim().length < 2 ? (
          <Text style={styles.supporting}>Type at least 2 characters to search file contents.</Text>
        ) : textResults.length ? (
          <View style={styles.list}>
            {textResults.map((match, index) => {
              const line = match.lines?.text || match.lines?.join?.(" ") || match.submatches?.[0]?.match || "Match";
              return <ListRow key={`${match.path}-${index}`} title={match.path} subtitle={line} onPress={() => setSelectedFile(match.path)} />;
            })}
          </View>
        ) : (
          <EmptyState title="No text matches" body="Try another query or refine the search pattern." />
        )}
      </Panel>

      <Panel>
        <SectionHeader eyebrow="Preview" title={selectedFile || "Pick a file"} action={selectedFile ? <PrimaryButton label="Clear" tone="ghost" onPress={() => setSelectedFile(null)} /> : null} />
        {!selectedFile ? (
          <EmptyState title="No file selected" body="Choose a file from changed files, file search, or text search to preview it here." />
        ) : fileContentQuery.data?.type === "text" ? (
          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
            <Text style={styles.previewText}>{fileContentQuery.data?.content || ""}</Text>
          </ScrollView>
        ) : fileContentQuery.data ? (
          <Text style={styles.supporting}>This file is not plain text or could not be rendered inline.</Text>
        ) : (
          <Text style={styles.supporting}>Loading file preview...</Text>
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  supporting: {
    color: colors.textMuted,
    fontFamily: type.body,
    lineHeight: 21,
  },
  list: {
    gap: spacing.sm,
  },
  previewScroll: {
    maxHeight: 360,
  },
  previewContent: {
    paddingBottom: spacing.md,
  },
  previewText: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 12,
    lineHeight: 18,
  },
});
