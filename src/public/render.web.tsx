import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRegistry } from "react-native";
import { PublicDocument } from "./PublicDocument.web";

AppRegistry.registerComponent("FootNationPublic", () => PublicDocument);
// The root project's legacy @types/react-dom targets React 18. This isolated
// renderer is bundled with Expo's React / React DOM 19, never the legacy pair.
const markup = renderToStaticMarkup as unknown as (element: React.ReactNode) => string;
export function renderPublicDocument(content: string, appPath: string) {
  const registry = AppRegistry as typeof AppRegistry & { getApplication(name: string, options: { initialProps: { content: string; appPath: string } }): { element: React.ReactElement; getStyleElement(): React.ReactElement } };
  const application = registry.getApplication("FootNationPublic", { initialProps: { content, appPath } });
  return { body: markup(application.element), styles: markup(application.getStyleElement()) };
}
