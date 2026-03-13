import { Modal } from "react-native";

import { Screen } from "./Screen";

export function ModalScreen({ visible, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen>{children}</Screen>
    </Modal>
  );
}
