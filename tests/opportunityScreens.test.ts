// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  push: vi.fn(),
  params: {} as Record<string, string>,
  fetchNextPage: vi.fn(),
}));
vi.mock("react-native", async () => import("react-native-web"));
vi.mock("lucide-react-native", () => ({
  ArrowRight: () => null,
  ChevronDown: () => null,
  Briefcase: () => null,
  FileText: () => null,
  Plus: () => null,
  Target: () => null,
  LockKeyhole: () => null,
}));
vi.mock("expo-router", () => ({
  router: { push: fixture.push },
  useLocalSearchParams: () => fixture.params,
}));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => fixture.query,
}));
vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "fixture-user" } } }),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
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
vi.mock("../src/components/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../src/components/ApplicationFollowup", () => ({
  ApplicationFollowup: () => null,
}));
vi.mock("../src/components/ui", () => ({
  useUIStyles: () => ({ small: {}, text: {}, h2: {} }),
  Screen: ({ children }: { children: React.ReactNode }) => children,
  Loading: () => React.createElement("p", {}, "Chargement"),
  ErrorState: ({ retry }: { retry: () => void }) =>
    React.createElement("button", { onClick: retry }, "Réessayer"),
}));
import MyRequests from "../src/screens/MyRequests";
import ProfileApplications from "../src/screens/ProfileApplications";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.push.mockReset();
  fixture.fetchNextPage.mockReset();
  fixture.params = {};
  fixture.query = {
    isPending: false,
    isError: false,
    data: { pages: [[]] },
    fetchNextPage: fixture.fetchNextPage,
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(element: React.ReactNode) {
  await act(async () => root.render(element));
}
it("conserve toutes les pages déjà chargées lorsqu’une page suivante échoue", async () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({
    id: String(i),
    title: `Demande ${i}`,
    is_active: true,
    created_at: "2026-09-01",
    expires_at: null,
  }));
  fixture.query = {
    ...fixture.query,
    data: { pages: [rows.slice(0, 30), rows.slice(30)] },
    isError: true,
    isFetchNextPageError: true,
    error: new Error("Erreur simulée"),
  };
  await render(React.createElement(MyRequests));
  expect(
    container.querySelectorAll('[aria-label="Voir ma demande"]'),
  ).toHaveLength(31);
  await act(async () => {
    (
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Réessayer",
      ) as HTMLElement
    ).click();
  });
  expect(fixture.fetchNextPage).toHaveBeenCalledOnce();
});
it("propose une création adaptée pour les demandes et les offres vides", async () => {
  await render(React.createElement(MyRequests));
  await act(async () => {
    (
      container.querySelector(
        '[aria-label="Créer ma première demande"]',
      ) as HTMLElement
    ).click();
  });
  expect(fixture.push).toHaveBeenLastCalledWith(
    "/opportunity/new?kind=request",
  );
  await render(React.createElement(MyRequests, { offers: true }));
  await act(async () => {
    (
      container.querySelector(
        '[aria-label="Créer ma première offre"]',
      ) as HTMLElement
    ).click();
  });
  expect(fixture.push).toHaveBeenLastCalledWith("/opportunity/new?kind=offer");
});
it("affiche les statuts et conserve une candidature dont l’annonce est indisponible", async () => {
  fixture.query.data = {
    pages: [
      [
        {
          id: "a",
          applicant_id: "fixture-user",
          status: "accepted",
          opportunities: null,
          created_at: "invalid",
          message: "Message privé",
        },
      ],
    ],
  };
  await render(React.createElement(ProfileApplications));
  expect(container.textContent).toContain("Acceptée");
  expect(container.textContent).toContain("Opportunité indisponible");
  expect(container.textContent).not.toContain("Invalid Date");
  expect(container.textContent).not.toContain("Message privé");
  expect(
    container.querySelector('[aria-label="Voir l’opportunité"]'),
  ).toBeNull();
});
it("oriente les candidatures vides vers Explorer ou les offres selon le mode", async () => {
  await render(React.createElement(ProfileApplications));
  expect(
    container.querySelector('[aria-label="Explorer les opportunités"]'),
  ).not.toBeNull();
  fixture.params = { mode: "received" };
  await render(React.createElement(ProfileApplications));
  expect(
    container.querySelector('[aria-label="Voir mes offres"]'),
  ).not.toBeNull();
});
