import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors, radii, shadows } from "../constants/theme";

export function Panel({ children, style, padded = true }) {
  return (
    <LinearGradient colors={[colors.cardTop, colors.cardBottom]} style={[styles.shell, style]}>
      <View style={[styles.inner, padded ? styles.padded : null]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.panel,
  },
  inner: {
    backgroundColor: "rgba(18, 15, 12, 0.48)",
  },
  padded: {
    padding: 18,
  },
});
