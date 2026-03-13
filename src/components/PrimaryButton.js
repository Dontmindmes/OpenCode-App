import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, type } from "../constants/theme";

export function PrimaryButton({ label, onPress, disabled, tone = "accent", style }) {
  const tones = {
    accent: { backgroundColor: colors.accent, labelColor: "#ffffff" },
    subtle: { backgroundColor: colors.surface, labelColor: colors.text },
    ghost: { backgroundColor: "transparent", labelColor: colors.textMuted },
    danger: { backgroundColor: colors.danger, labelColor: "#ffffff" },
  };
  const palette = tones[tone];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor },
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontFamily: type.mono,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
});
