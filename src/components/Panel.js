import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

export function Panel({ children, style, padded = true }) {
  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.inner, padded ? styles.padded : null]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  inner: {
    backgroundColor: colors.surfaceSoft,
  },
  padded: {
    padding: spacing.md,
  },
});
