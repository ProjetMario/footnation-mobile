import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CreationStudio from "../src/screens/CreationStudio";
export default function ComposeRoute() {
  return (
    <SafeAreaProvider>
      <CreationStudio defaultMode="post" />
    </SafeAreaProvider>
  );
}
