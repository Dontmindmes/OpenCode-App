import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../constants/theme";

export function EmptyState({ title, body }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 22,
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: "rgba(255, 244, 222, 0.03)",
  },
  title: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 18,
  },
  body: {
    color: colors.textMuted,
    fontFamily: type.body,
    lineHeight: 22,
  },
});
