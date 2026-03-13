import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../constants/theme";

export function SectionHeader({ eyebrow, title, action }) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.accentStrong,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: type.mono,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: type.display,
  },
});
