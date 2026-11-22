import { describe, expect, it } from "vitest";
import { sessionUsesProvider } from "../src/lib/socialSession";

describe("session provider detection", () => {
  it("detects Apple from Supabase app metadata", () => {
    expect(
      sessionUsesProvider(
        {
          user: {
            app_metadata: { provider: "apple", providers: ["apple"] },
          },
        } as any,
        "apple",
      ),
    ).toBe(true);
  });

  it("detects Apple from Supabase identities when app metadata is generic", () => {
    expect(
      sessionUsesProvider(
        {
          user: {
            identities: [{ provider: "apple" }],
            app_metadata: { provider: "email", providers: ["email"] },
          },
        } as any,
        "apple",
      ),
    ).toBe(true);
  });

  it("does not match another provider or missing metadata", () => {
    expect(
      sessionUsesProvider(
        {
          user: {
            app_metadata: { provider: "google", providers: ["google"] },
          },
        } as any,
        "apple",
      ),
    ).toBe(false);
    expect(sessionUsesProvider(null, "apple")).toBe(false);
  });
});
