import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";
import { Screen } from "./Screen";

export function ModalScreen({ visible, onClose, children, presentation = "sheet" }) {
  if (presentation === "popover") {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.popover}>{children}</View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen>{children}</Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(245, 245, 242, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  popover: {
    maxHeight: "72%",
    borderRadius: 34,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    padding: spacing.lg,
  },
});
