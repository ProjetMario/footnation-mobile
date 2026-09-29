import React from "react";
import type { ErrorBoundaryProps } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { reportError } from "../lib/monitoring";
import { Button, Empty, Screen } from "./ui";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    reportError(error, "render");
  }
  render(): React.ReactNode {
    return this.state.failed ? (
      <Screen title="FootNation" back={false}>
        <Empty
          title="Une erreur est survenue"
          description="Vous pouvez réessayer d’ouvrir cet écran."
        />
        <Button
          title="Réessayer"
          onPress={() => this.setState({ failed: false })}
        />
      </Screen>
    ) : (
      this.props.children
    );
  }
}

export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => reportError(error, "render"), [error]);
  return (
    <SafeAreaProvider>
      <Screen title="FootNation" back={false}>
        <Empty
          title="Une erreur est survenue"
          description="Vos contenus enregistrés sont conservés. Réessayez d’ouvrir cet écran."
        />
        <Button
          title="Réessayer"
          busy={busy}
          onPress={() => {
            setBusy(true);
            void retry()
              .catch((nextError: unknown) => reportError(nextError, "render"))
              .finally(() => setBusy(false));
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}
