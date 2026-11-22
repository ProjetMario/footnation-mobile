// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rpc: vi.fn(),
  tracking: { read_at: null, last_reminded_at: null } as {
    read_at: string | null;
    last_reminded_at: string | null;
  },
}));
vi.mock("react-native", async () => import("react-native-web"));
vi.mock("lucide-react-native", () => ({
  Eye: () => null,
  ArrowRight: () => null,
  ChevronDown: () => null,
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "fixture-user" } } }),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: fixture.tracking, error: null }),
        }),
      }),
    }),
    rpc: fixture.rpc,
  },
}));
vi.mock("../src/theme", () => ({
  useTheme: () => ({
    mode: "light",
    colors: {
      ink: "#101828",
      muted: "#667085",
      surface: "#fff",
      border: "#ddd",
      background: "#fff",
    },
  }),
}));
vi.mock("../src/components/ui", () => ({
  useUIStyles: () => ({ small: {}, text: {} }),
  Button: () => null,
  ErrorState: ({ error }: { error: Error }) =>
    React.createElement("p", { role: "alert" }, error.message),
}));
import { ApplicationFollowup } from "../src/components/ApplicationFollowup";

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const application = {
  id: "fixture-application",
  applicant_id: "fixture-user",
  status: "pending",
  created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  message: "Mon projet de joueur",
};
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.tracking = { read_at: null, last_reminded_at: null };
  fixture.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});
async function render(owner = false, status = "pending") {
  await act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ApplicationFollowup, {
          application: { ...application, status },
          owner,
          dashboard: true,
        }),
      ),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
function button(title: string) {
  return container.querySelector(`[aria-label="${title}"]`) as HTMLElement;
}
async function click(title: string) {
  await act(async () => {
    button(title).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
describe("Suivi des candidatures — présentation et actions simulées", () => {
  it("conserve le délai de trois jours et n’envoie rien quand la relance est indisponible", async () => {
    fixture.tracking.last_reminded_at = new Date().toISOString();
    await render();
    expect(button("Relancer l’auteur").getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(container.textContent).toContain("Lecture non confirmée");
    expect(container.textContent).toContain("Prochaine relance possible");
    await click("Relancer l’auteur");
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("envoie une relance admissible et affiche sa confirmation", async () => {
    await render();
    await click("Relancer l’auteur");
    expect(fixture.rpc).toHaveBeenCalledWith("manage_opportunity_application", {
      p_application_id: application.id,
      p_action: "remind",
      p_status: null,
    });
    expect(container.textContent).toContain("Relance envoyée");
  });
  it("garde le message reçu fermé tant que l’ouverture serveur n’a pas réussi", async () => {
    fixture.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Erreur simulée" },
    });
    await render(true);
    expect(container.textContent).not.toContain(application.message);
    await click("Ouvrir la candidature");
    expect(container.textContent).toContain("Erreur simulée");
    expect(button("Accepter")).toBeNull();
    await click("Ouvrir la candidature");
    await click("Voir le message");
    expect(container.textContent).toContain(application.message);
    await click("Accepter");
    expect(fixture.rpc).toHaveBeenLastCalledWith(
      "manage_opportunity_application",
      {
        p_application_id: application.id,
        p_action: "status",
        p_status: "accepted",
      },
    );
  });
  it("n’affiche pas de relance pour une candidature terminée", async () => {
    fixture.tracking.read_at = "2026-09-20T12:00:00Z";
    await render(false, "accepted");
    expect(button("Relancer l’auteur")).toBeNull();
    expect(container.textContent).toContain("Lue le");
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
});
