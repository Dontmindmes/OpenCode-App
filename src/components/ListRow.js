import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../constants/theme";

export function ListRow({ title, subtitle, meta, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.side}>{meta}{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontFamily: type.heading,
    fontSize: 17,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    lineHeight: 20,
  },
  side: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
});
