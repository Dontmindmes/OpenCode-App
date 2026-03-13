import { StyleSheet, TextInput, View } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";
import { PrimaryButton } from "./PrimaryButton";

export function Composer({ value, onChangeText, onSend, sending, onAbort, canAbort }) {
  return (
    <View style={styles.wrap}>
      <TextInput
        multiline
        placeholder="Send a prompt or /command"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
      <View style={styles.actions}>
        {canAbort ? <PrimaryButton label="Abort" tone="ghost" onPress={onAbort} style={styles.abort} /> : null}
        <PrimaryButton label={sending ? "Sending..." : "Send"} onPress={onSend} disabled={sending || !value.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  input: {
    minHeight: 116,
    maxHeight: 220,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(255, 244, 222, 0.06)",
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  abort: {
    minWidth: 88,
  },
});
