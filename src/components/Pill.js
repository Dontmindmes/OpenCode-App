import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";

export function Pill({ children, active, onPress, tone = "default", style }) {
  const palette = active
    ? { bg: colors.surface, text: colors.text, border: colors.borderStrong }
    : tone === "cool"
      ? { bg: "rgba(30, 183, 207, 0.08)", text: colors.accentCool, border: "rgba(30, 183, 207, 0.16)" }
      : { bg: colors.surfaceSoft, text: colors.textMuted, border: colors.border };

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: type.mono,
    fontSize: 12,
  },
});
