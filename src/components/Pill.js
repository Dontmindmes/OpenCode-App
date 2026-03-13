import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";

export function Pill({ children, active, onPress, tone = "default", style }) {
  const palette = active
    ? { bg: colors.accent, text: "#20160b", border: colors.accent }
    : tone === "cool"
      ? { bg: "rgba(116, 192, 184, 0.13)", text: colors.accentCool, border: "rgba(116, 192, 184, 0.3)" }
      : { bg: colors.surfaceSoft, text: colors.textMuted, border: colors.borderStrong };

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
    fontFamily: type.body,
    fontSize: 12,
  },
});
