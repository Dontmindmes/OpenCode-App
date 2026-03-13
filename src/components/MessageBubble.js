import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";

export function MessageBubble({ message }) {
  const role = message?.info?.role || message?.info?.type || "assistant";
  const isUser = role === "user";
  
  let parts = [];
  if (Array.isArray(message?.parts)) {
    parts = message.parts;
  } else if (Array.isArray(message?.content)) {
    parts = message.content;
  } else if (Array.isArray(message?.messages)) {
    parts = message.messages;
  } else if (message?.text) {
    parts = [{ type: "text", text: message.text }];
  } else if (message?.message?.text) {
    parts = [{ type: "text", text: message.message.text }];
  }
  
  const timestamp = formatMessageTime(message?.time?.created || message?.time?.updated || message?.info?.time);

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {parts.length ? parts.map((part, index) => <PartBlock key={part.id || `${role}-${index}`} part={part} isUser={isUser} />) : <Text style={[styles.body, isUser ? styles.userBody : null]}>No visible content yet.</Text>}
        {timestamp ? <Text style={[styles.time, isUser ? styles.userTime : styles.assistantTime]}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

function formatMessageTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PartBlock({ part, isUser }) {
  if (!part) {
    return null;
  }

  if (part.type === "text") {
    return <Text style={[styles.body, isUser ? styles.userBody : null]}>{part.text}</Text>;
  }

  if (part.type === "reasoning") {
    return null;
  }

  if (part.type === "tool") {
    const status = part.state?.status || "pending";
    return (
      <View style={styles.partBlock}>
        <View style={styles.partHeader}>
          <Text style={styles.partLabel}>{part.tool || "Tool"}</Text>
          <Text style={styles.partMeta}>{status}</Text>
        </View>
      </View>
    );
  }

  if (part.type === "file") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>File</Text>
        <Text style={styles.code}>{part.filename || part.source?.path || part.url}</Text>
      </View>
    );
  }

  if (part.type === "patch") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>Edited files</Text>
        <Text style={styles.code}>{(part.files || []).join("\n")}</Text>
      </View>
    );
  }

  if (part.type === "agent") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>Agent</Text>
        <Text style={styles.body}>{part.name}</Text>
      </View>
    );
  }

  if (part.type === "subtask") {
    return (
      <View style={styles.partBlock}>
        <Text style={styles.partLabel}>Subtask</Text>
        <Text style={styles.body}>{part.description}</Text>
      </View>
    );
  }

  if (part.type === "step-start" || part.type === "step-finish") {
    return null;
  }

  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%", paddingHorizontal: spacing.xs },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", paddingHorizontal: 18, paddingVertical: 14, gap: spacing.xs },
  userBubble: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 22,
    minWidth: 100,
  },
  assistantBubble: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: 22,
  },
  body: { color: colors.text, fontFamily: type.mono, fontSize: 14, lineHeight: 21 },
  userBody: { color: "#ffffff" },
  partBlock: { gap: spacing.xs, paddingTop: spacing.sm },
  partHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  partLabel: { color: colors.textMuted, fontFamily: type.mono, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  partMeta: { color: colors.textDim, fontFamily: type.mono, fontSize: 10 },
  code: { color: colors.textMuted, fontFamily: type.mono, fontSize: 11, lineHeight: 16 },
  time: { fontFamily: type.mono, fontSize: 10, marginTop: spacing.xs },
  userTime: { color: "rgba(255, 255, 255, 0.6)", alignSelf: "flex-end" },
  assistantTime: { color: colors.textDim },
});
