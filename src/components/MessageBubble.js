import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";
import { compactJson } from "../lib/format";

export function MessageBubble({ message }) {
  const role = message?.info?.role || message?.info?.type || "assistant";
  const isUser = role === "user";
  const parts = Array.isArray(message?.parts) ? message.parts : [];

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.role, isUser ? styles.userRole : styles.assistantRole]}>{role.toUpperCase()}</Text>
        {parts.length ? parts.map((part, index) => <PartBlock key={part.id || `${role}-${index}`} part={part} isUser={isUser} />) : <Text style={[styles.body, isUser ? styles.userBody : null]}>No visible content yet.</Text>}
      </View>
    </View>
  );
}

function PartBlock({ part, isUser }) {
  if (!part) {
    return null;
  }

  if (part.type === "text") {
    return <Text style={[styles.body, isUser ? styles.userBody : null]}>{part.text}</Text>;
  }

  if (part.type === "reasoning") {
    return (
      <View style={styles.reasoningBlock}>
        <Text style={styles.partLabel}>REASONING</Text>
        <Text style={styles.reasoningText}>{part.text}</Text>
      </View>
    );
  }

  if (part.type === "tool") {
    const status = part.state?.status || "pending";
    return (
      <View style={styles.partBlock}>
        <View style={styles.partHeader}>
          <Text style={styles.partLabel}>{part.tool}</Text>
          <Text style={styles.partMeta}>{status.toUpperCase()}</Text>
        </View>
        <Text style={styles.code}>{compactJson(part.state?.input || part.state?.output || part.state || {})}</Text>
      </View>
    );
  }

  if (part.type === "file") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>FILE</Text>
        <Text style={styles.code}>{part.filename || part.source?.path || part.url}</Text>
      </View>
    );
  }

  if (part.type === "patch") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>PATCH</Text>
        <Text style={styles.code}>{(part.files || []).join("\n")}</Text>
      </View>
    );
  }

  if (part.type === "agent") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>AGENT</Text>
        <Text style={styles.body}>{part.name}</Text>
      </View>
    );
  }

  if (part.type === "subtask") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>SUBTASK</Text>
        <Text style={styles.body}>{part.description}</Text>
        <Text style={styles.code}>{part.prompt}</Text>
      </View>
    );
  }

  if (part.type === "step-start" || part.type === "step-finish") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>{part.type.toUpperCase()}</Text>
        <Text style={styles.body}>{compactJson(part)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.partBlock}>
      <Text style={styles.partLabel}>{String(part.type || "PART").toUpperCase()}</Text>
      <Text style={styles.code}>{compactJson(part)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "94%", borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  userBubble: { backgroundColor: colors.accent },
  assistantBubble: { backgroundColor: "rgba(255, 244, 222, 0.07)", borderWidth: 1, borderColor: colors.border },
  role: { fontFamily: type.mono, fontSize: 11, letterSpacing: 1.2 },
  userRole: { color: "#3f2a11" },
  assistantRole: { color: colors.accentStrong },
  body: { color: colors.text, fontFamily: type.body, fontSize: 15, lineHeight: 22 },
  userBody: { color: "#281a0a" },
  partBlock: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: "rgba(255, 244, 222, 0.08)" },
  partHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  partLabel: { color: colors.accentStrong, fontFamily: type.mono, fontSize: 11, letterSpacing: 1.1 },
  partMeta: { color: colors.textDim, fontFamily: type.mono, fontSize: 11 },
  code: { color: colors.text, fontFamily: type.mono, fontSize: 12, lineHeight: 18 },
  reasoningBlock: { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, backgroundColor: "rgba(116, 192, 184, 0.08)" },
  reasoningText: { color: colors.textMuted, fontFamily: type.body, lineHeight: 20 },
});
