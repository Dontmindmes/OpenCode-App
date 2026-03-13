import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors, radii, spacing, type } from "../constants/theme";

export function Composer({
  value,
  onChangeText,
  onSend,
  sending,
  onAbort,
  canAbort,
  modelLabel,
  reasoningLabel,
  modeLabel,
  onOpenCommands,
  onOpenModel,
  onOpenReasoning,
  onOpenMode,
  onOpenWorkspace,
  workspaceLabel,
  statusLabel,
  branchLabel,
}) {
  return (
    <View style={styles.wrap}>
      {canAbort ? (
        <View style={styles.steerRow}>
          <Text style={styles.steerLabel}>Running...</Text>
          <Pressable onPress={onAbort} style={styles.steerButton}>
            <Text style={styles.steerButtonLabel}>Stop</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.mainRow}>
        <Pressable onPress={onOpenModel} style={styles.pill}>
          <Text style={styles.pillText}>{modelLabel || "Model"}</Text>
        </Pressable>
        <Pressable onPress={onOpenReasoning} style={styles.pill}>
          <Text style={styles.pillText}>{reasoningLabel || "Reasoning"}</Text>
        </Pressable>
        <Pressable onPress={onOpenMode} style={styles.pill}>
          <Text style={styles.pillTextAccent}>{modeLabel || "Mode"}</Text>
        </Pressable>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          placeholder="Ask something..."
          placeholderTextColor={colors.textDim}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Pressable onPress={onSend} disabled={sending || !value.trim()} style={[styles.sendButton, sending || !value.trim() ? styles.sendButtonDisabled : null]}>
          <Feather name="arrow-up" size={18} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  steerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  steerLabel: {
    color: colors.textMuted,
    fontFamily: type.mono,
    fontSize: 11,
  },
  steerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  steerButtonLabel: {
    color: colors.text,
    fontFamily: type.mono,
    fontSize: 11,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    color: colors.textDim,
    fontFamily: type.mono,
    fontSize: 10,
  },
  pillTextAccent: {
    color: colors.accentCool,
    fontFamily: type.mono,
    fontSize: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontFamily: type.mono,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  sendButtonDisabled: {
    opacity: 0.2,
  },
});
