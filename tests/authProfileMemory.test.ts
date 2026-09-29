import { describe, expect, it } from "vitest";
import { createAuthProfileMemory } from "../src/lib/authProfileMemory";
import type { Profile } from "../src/lib/models";

const profile = (id: string, extra: Partial<Profile> = {}): Profile => ({
  id,
  full_name: `Member ${id}`,
  username: id,
  avatar_url: null,
  ...extra,
});

describe("validated profile memory", () => {
  it("does not classify an offline startup as a missing profile", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    expect(memory.read("a")).toEqual({ status: "unverified", profile: null });
  });

  it("keeps a confirmed profile available only for the same account", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    memory.confirm(memory.begin(), "a", profile("a"));
    expect(memory.read("a").status).toBe("ready");
    expect(memory.read("a").profile?.id).toBe("a");
    expect(memory.read("b")).toEqual({ status: "unverified", profile: null });
  });

  it("retains the verified profile through same-account token updates", () => {
    const memory = createAuthProfileMemory();
    expect(memory.changeAccount("a")).toEqual({
      changed: true,
      clearCache: false,
    });
    memory.confirm(memory.begin(), "a", profile("a"));
    expect(memory.changeAccount("a")).toEqual({
      changed: false,
      clearCache: false,
    });
    expect(memory.read("a").status).toBe("ready");
  });

  it("erases the profile when switching accounts, even when switching back offline", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    memory.confirm(memory.begin(), "a", profile("a"));
    expect(memory.changeAccount("b")).toEqual({
      changed: true,
      clearCache: true,
    });
    expect(memory.read("b").status).toBe("unverified");
    memory.changeAccount("a");
    expect(memory.read("a")).toEqual({ status: "unverified", profile: null });
  });

  it("erases the validated profile after signout", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    memory.confirm(memory.begin(), "a", profile("a"));
    expect(memory.changeAccount(null).clearCache).toBe(true);
    expect(memory.read("a").profile).toBeNull();
    memory.changeAccount("a");
    expect(memory.read("a").status).toBe("unverified");
  });

  it("treats profile absence as confirmed only after a successful lookup", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    expect(memory.read("a").status).toBe("unverified");
    memory.confirm(memory.begin(), "a", null);
    expect(memory.read("a")).toEqual({ status: "missing", profile: null });
  });

  it("immediately removes a profile when suspension is confirmed and preserves that block offline", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    memory.confirm(memory.begin(), "a", profile("a"));
    memory.confirm(memory.begin(), "a", profile("a", { is_suspended: true }));
    expect(memory.read("a")).toEqual({ status: "suspended", profile: null });
    memory.changeAccount("a");
    expect(memory.read("a").status).toBe("suspended");
  });

  it("ignores an old lookup after switching away and back to the same account", async () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    const oldTicket = memory.begin();
    const lateLookup = Promise.resolve(profile("a"));
    memory.changeAccount("b");
    memory.changeAccount("a");
    expect(memory.confirm(oldTicket, "a", await lateLookup)).toBeNull();
    expect(memory.read("a").status).toBe("unverified");
  });

  it("prevents an older successful response from replacing a newer suspension", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    const oldTicket = memory.begin();
    memory.confirm(memory.begin(), "a", profile("a", { is_suspended: true }));
    expect(memory.confirm(oldTicket, "a", profile("a"))).toBeNull();
    expect(memory.read("a").status).toBe("suspended");
  });

  it("ignores all pending results after unmount and rejects a mismatched profile", () => {
    const memory = createAuthProfileMemory();
    memory.changeAccount("a");
    const ticket = memory.begin();
    memory.invalidate();
    expect(memory.isCurrent(ticket)).toBe(false);
    expect(memory.confirm(ticket, "a", profile("a"))).toBeNull();
    expect(() => memory.confirm(memory.begin(), "a", profile("b"))).toThrow(
      "ne correspond pas",
    );
    expect(memory.read("a").status).toBe("unverified");
  });
});
