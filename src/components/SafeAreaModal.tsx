import React from "react";
import { Modal, type ModalProps } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

/** A native modal is a separate window: measure its insets inside that window.
 * Children choose their own SafeAreaView edges so media can remain full bleed.
 * Do not seed this remounting provider with the app window's initial metrics.
 */
export function SafeAreaModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>
    </Modal>
  );
}
